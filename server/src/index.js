import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { connectDB } from "./db.js";
import router from "./routes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../../client/dist");

if (config.isProduction) {
  const problems = [];
  if (!process.env.MONGODB_URI) problems.push("MONGODB_URI must be set");
  if (config.jwtSecret.length < 32 || config.jwtSecret === "development-only-change-this-secret") problems.push("JWT_SECRET must contain at least 32 characters");
  if (!config.aiKey) problems.push(`${config.aiProvider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} must be set`);
  if (!fs.existsSync(path.join(clientDist, "index.html"))) problems.push("Production frontend build is missing; run npm run build");
  if (problems.length) {
    console.error(`Refusing production startup: ${problems.join("; ")}.`);
    process.exit(1);
  }
}

const app = express();
if (config.trustProxy) app.set("trust proxy", config.trustProxy);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.clientOrigins.includes("*") || config.clientOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: false
}));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(config.isProduction ? "combined" : "dev"));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-7", legacyHeaders: false }));
app.get("/health", (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    ok: dbConnected,
    service: "personal-ai-assistant",
    dbConnected,
    aiProvider: config.aiProvider,
    aiConfigured: Boolean(config.aiKey),
    webSearchConfigured: Boolean(config.tavilyKey),
    ocrEnabled: config.enableOcr,
    dockerCodeEnabled: config.enableDockerCode
  });
});
app.use("/api", router);
app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found" }));

if (config.isProduction) {
  app.use(express.static(clientDist, { index: false, maxAge: "1d" }));
  app.get("*", (req, res, next) => {
    if (req.path === "/health" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"), error => { if (error) next(error); });
  });
}

app.use((err, _req, res, _next) => {
  const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  res.status(status).json({ error: err.message || "Request failed" });
});

connectDB().then(() => {
  const server = app.listen(config.port, "0.0.0.0", () => console.log(`Personal AI listening on port ${config.port}`));
  const shutdown = signal => {
    console.log(`${signal} received; closing server.`);
    server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}).catch(err => {
  console.error("Could not connect to MongoDB:", err.name, err.code || "");
  process.exit(1);
});
