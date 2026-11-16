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
const publicDir = path.resolve(here, "../../public");

function validateProductionConfiguration() {
  const problems = [];
  if (!process.env.MONGODB_URI) problems.push("MONGODB_URI must be set");
  if (config.jwtSecret.length < 32 || config.jwtSecret === "development-only-change-this-secret") problems.push("JWT_SECRET must contain at least 32 characters");
  if (!config.aiKey) problems.push(`${config.aiProvider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} must be set`);
  if (!config.isVercel && !fs.existsSync(path.join(publicDir, "index.html"))) problems.push("Production frontend build is missing; run npm run build");
  if (problems.length) throw new Error(`Refusing production startup: ${problems.join("; ")}.`);
}

export function createApp(expressModule = express) {
  if (config.isProduction) validateProductionConfiguration();

  const app = expressModule();
  if (config.trustProxy || config.isVercel) app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.clientOrigins.includes("*") || config.clientOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: false
  }));
  app.use(expressModule.json({ limit: "2mb" }));
  app.use(morgan(config.isProduction ? "combined" : "dev"));
  app.use("/api", rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-7", legacyHeaders: false }));
  app.use(async (_req, _res, next) => {
    try {
      await connectDB();
      next();
    } catch (error) {
      error.status = 503;
      next(error);
    }
  });
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

  if (config.isProduction && !config.isVercel) {
    app.use(expressModule.static(publicDir, { index: false, maxAge: "1d" }));
    app.get("*", (req, res, next) => {
      if (req.path === "/health" || req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(publicDir, "index.html"), error => { if (error) next(error); });
    });
  }

  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FILE_COUNT" ? 413 : 400);
    res.status(status).json({ error: err.message || "Request failed" });
  });

  return app;
}
