import mongoose from "mongoose";
import { config } from "./config.js";

function getMongoUri() {
  const uri = String(config.mongoUri || "").trim().replace(/^['"]|['"]$/g, "");
  if (!uri) throw new Error("MONGODB_URI is empty. Add your MongoDB connection string to server/.env.");
  if (/[<>]/.test(uri)) throw new Error("MONGODB_URI still contains placeholder brackets. Replace the example username, password, and host with your real MongoDB values.");
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error("Invalid MONGODB_URI. It must start with mongodb:// or mongodb+srv://.");
  }
  if (/^mongodb\+srv:\/\//i.test(uri)) {
    const authority = uri.replace(/^mongodb\+srv:\/\//i, "").split(/[/?#]/, 1)[0];
    if (authority.includes(",") || /:\d+$/.test(authority)) {
      throw new Error("Invalid MongoDB SRV URI. An mongodb+srv:// URI must contain one cluster hostname and must not include a port or comma-separated hosts.");
    }
  }
  return uri;
}

function explainMongoError(error) {
  const message = String(error?.message || "");
  const code = error?.code || error?.cause?.code || "";
  if (/authentication failed|bad auth|auth failed/i.test(message)) {
    return "MongoDB authentication failed. Check the Atlas Database Access username/password, ensure the database user exists, and URL-encode reserved password characters such as @, :, /, #, ?, and % in the connection URI.";
  }
  if (/querySrv|ENOTFOUND|ECONNREFUSED.*(27017|mongodb)|DNS/i.test(message) || code === "ENOTFOUND") {
    return "MongoDB hostname/DNS lookup failed. For mongodb+srv://, check your internet/DNS and use the exact SRV URI copied from Atlas. If SRV DNS is blocked, copy Atlas's Standard connection string (mongodb:// with all three hosts) instead.";
  }
  if (/ETIMEDOUT|ECONNRESET|server selection timed out|TLS|SSL|handshake/i.test(message) || ["ETIMEDOUT", "ECONNRESET"].includes(code)) {
    return "MongoDB could not be reached. In Atlas, add your current public IP under Network Access, confirm the cluster is active, allow outbound TCP port 27017, and check whether a VPN, firewall, antivirus, or school/work network is blocking the connection. Do not disable TLS certificate validation.";
  }
  if (/Invalid scheme|Invalid connection string|URI malformed|Invalid URL/i.test(message)) {
    return "MongoDB rejected the connection-string format. Copy a fresh URI from Atlas > Connect > Drivers, replace the placeholders, and URL-encode special characters in the database password.";
  }
  return "Check the MongoDB URI, database user permissions, Atlas IP access list, and network connection. The detailed driver error is printed below without exposing your URI.";
}

export async function connectDB() {
  const uri = getMongoUri();
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 0,
      family: 4
    });
    console.log(`MongoDB connected (${mongoose.connection.name || "database"})`);
    mongoose.connection.on("error", error => {
      console.error("MongoDB connection error:", error.message);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Check the database/network connection.");
    });
  } catch (error) {
    console.error("\nMongoDB connection failed.");
    console.error(explainMongoError(error));
    const safeDetail = String(error?.message || "Unknown error").replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "mongodb://<redacted>");
    console.error(`Driver detail: ${error?.name || "Error"}${error?.code ? ` (${error.code})` : ""}: ${safeDetail}`);
    console.error("The MONGODB_URI value has not been printed. Check server/.env locally.\n");
    throw error;
  }
}
