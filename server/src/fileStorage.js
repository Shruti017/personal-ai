import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

const legacyUploadDir = path.resolve("uploads");
let cachedDb;
let cachedBucket;

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB must be connected before storing uploaded files.");
  if (cachedDb !== db) {
    cachedDb = db;
    cachedBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "assistantFiles" });
  }
  return cachedBucket;
}

export function storeUploadedFile(buffer, filename, userId) {
  return new Promise((resolve, reject) => {
    const stream = getBucket().openUploadStream(filename, {
      metadata: { userId: String(userId) }
    });
    stream.once("error", reject);
    stream.once("finish", () => resolve(stream.id.toString()));
    stream.end(buffer);
  });
}

export async function readStoredFile(storedName) {
  if (!/^[a-f\d]{24}$/i.test(String(storedName))) {
    return fs.readFile(path.join(legacyUploadDir, path.basename(String(storedName))));
  }
  const chunks = [];
  const stream = getBucket().openDownloadStream(new mongoose.Types.ObjectId(storedName));
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function deleteStoredFile(storedName) {
  if (!/^[a-f\d]{24}$/i.test(String(storedName))) {
    await fs.unlink(path.join(legacyUploadDir, path.basename(String(storedName)))).catch(() => {});
    return;
  }
  await getBucket().delete(new mongoose.Types.ObjectId(storedName)).catch(error => {
    if (error.codeName !== "FileNotFound") throw error;
  });
}
