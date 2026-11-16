import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Always load server/.env relative to this file, regardless of the terminal working directory.
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(serverDir, ".env") });

const aiProvider = (process.env.AI_PROVIDER || "openai").trim().toLowerCase();
const providerDefaults = {
  openai: {
    key: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-6-astra"
  },
  gemini: {
    key: process.env.GEMINI_API_KEY || "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.8-flash"
  }
};
if (!providerDefaults[aiProvider]) throw new Error("AI_PROVIDER must be either openai or gemini.");
const selectedProvider = providerDefaults[aiProvider];
const clientOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 5000),
  clientOrigins,
  mongoUri: (process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/personal_ai_assistant").trim(),
  jwtSecret: process.env.JWT_SECRET || "development-only-change-this-secret",
  aiProvider,
  aiKey: (selectedProvider.key || "").trim(),
  aiBaseUrl: (process.env.AI_BASE_URL || selectedProvider.baseUrl).replace(/\/$/, ""),
  aiModel: (process.env.AI_MODEL || process.env[`${aiProvider.toUpperCase()}_MODEL`] || selectedProvider.model).trim(),
  tavilyKey: process.env.TAVILY_API_KEY || "",
  enableDockerCode: process.env.ENABLE_DOCKER_CODE === "true",
  pythonDockerImage: process.env.PYTHON_DOCKER_IMAGE || "python:3.12-slim",
  nodeDockerImage: process.env.NODE_DOCKER_IMAGE || "node:22-slim",
  maxFileMb: Number(process.env.MAX_FILE_MB || 25),
  enableOcr: process.env.ENABLE_OCR === "true",
  ocrLanguages: process.env.OCR_LANGUAGES || "eng+ben",
  trustProxy: process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true" ? 1 : false,
  isProduction: process.env.NODE_ENV === "production"
};
