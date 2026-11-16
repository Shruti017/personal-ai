import { createApp } from "./app.js";
import { connectDB } from "./db.js";
import { config } from "./config.js";

const app = createApp();

connectDB().then(() => {
  const server = app.listen(config.port, "0.0.0.0", () => console.log(`Personal AI listening on port ${config.port}`));
  const shutdown = signal => {
    console.log(`${signal} received; closing server.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}).catch(err => {
  console.error("Could not connect to MongoDB:", err.name, err.code || "");
  process.exit(1);
});
