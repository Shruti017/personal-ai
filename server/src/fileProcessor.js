import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import yauzl from "yauzl";
import mammoth from "mammoth";
// Import the library implementation directly. The package entry point detects
// ESM imports as its debug mode and tries to read a test fixture at startup.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { config } from "./config.js";

const textExtensions = new Set([".txt",".md",".rtf",".html",".htm",".js",".jsx",".ts",".tsx",".py",".java",".c",".cpp",".h",".hpp",".php",".css",".json",".xml",".yml",".yaml",".sql",".sh",".env.example",".log"]);
const imageMimes = new Set(["image/png","image/jpeg","image/webp","image/gif"]);

function splitChunks(text, locatorPrefix = "chunk", size = 1100, overlap = 160) {
  const clean = (text || "").replace(/\u0000/g, "").trim();
  const chunks = [];
  let start = 0, index = 1;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + size);
    const part = clean.slice(start, end).trim();
    if (part) chunks.push({ text: part, locator: `${locatorPrefix} ${index}` });
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - overlap);
    index++;
  }
  return chunks;
}

function decodeXml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const code = lower.startsWith("#x") ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });
}

function parseCsv(buffer) {
  const input = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.length === 0) quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length || input.endsWith(",")) { row.push(cell); rows.push(row); }
  return rows.map(values => values.join(" | ")).join("\n");
}

function parseXlsxEntries(entries) {
  const files = new Map(entries.map(entry => [entry.name, entry.buffer.toString("utf8")]));
  const sharedXml = files.get("xl/sharedStrings.xml") || "";
  const sharedStrings = [...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
    .map(match => [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(text => decodeXml(text[1])).join(""));
  const sheets = [...files.entries()]
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort(([a], [b]) => Number(a.match(/sheet(\d+)/i)[1]) - Number(b.match(/sheet(\d+)/i)[1]));
  return sheets.map(([name, xml], index) => {
    const rows = [...xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)].map(rowMatch => {
      const cells = [];
      for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cellMatch[1];
        const ref = attrs.match(/\br="([A-Z]+)\d+"/i)?.[1];
        let column = 0;
        if (ref) for (const char of ref.toUpperCase()) column = column * 26 + char.charCodeAt(0) - 64;
        if (column > 0) cells[column - 1] = "";
        const type = attrs.match(/\bt="([^"]+)"/)?.[1];
        const body = cellMatch[2];
        const raw = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
        const inline = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(text => decodeXml(text[1])).join("");
        const value = type === "s" && raw !== undefined ? sharedStrings[Number(raw)] || ""
          : type === "inlineStr" ? inline
            : type === "b" && raw !== undefined ? (raw === "1" ? "TRUE" : "FALSE")
              : raw === undefined ? inline : decodeXml(raw);
        if (column > 0) cells[column - 1] = value;
      }
      return cells.join(" | ");
    });
    return { name: `Sheet ${index + 1}`, text: rows.join("\n") };
  });
}

function readZipEntries(filePath, limits = { count: 100, bytes: 40 * 1024 * 1024 }) {
  return new Promise((resolve, reject) => {
    const results = [];
    let total = 0;
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err) return reject(err);
      zip.readEntry();
      zip.on("entry", entry => {
        const normalized = path.posix.normalize(entry.fileName.replace(/\\/g, "/"));
        if (normalized.startsWith("../") || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
          zip.readEntry(); return;
        }
        if (/\/$/.test(entry.fileName)) { zip.readEntry(); return; }
        if (results.length >= limits.count || total + entry.uncompressedSize > limits.bytes) {
          zip.close(); return resolve(results);
        }
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr) { zip.readEntry(); return; }
          const parts = [];
          stream.on("data", chunk => parts.push(chunk));
          stream.on("end", () => {
            const buffer = Buffer.concat(parts);
            total += buffer.length;
            results.push({ name: normalized, buffer });
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve(results));
      zip.on("error", reject);
    });
  });
}

export async function extractBuffer(name, buffer, mimeType = "") {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".pdf" || mimeType === "application/pdf") {
    const parsed = await pdfParse(buffer);
    return { text: parsed.text || "", chunks: splitChunks(parsed.text || "", "PDF chunk") };
  }
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value || "", chunks: splitChunks(result.value || "", "DOCX chunk") };
  }
  if (ext === ".pptx") {
    const tmp = path.join(os.tmpdir(), `pptx-${Date.now()}-${Math.random().toString(16).slice(2)}.pptx`);
    await fs.writeFile(tmp, buffer);
    try {
      const entries = await readZipEntries(tmp, { count: 500, bytes: 80 * 1024 * 1024 });
      const slides = entries.filter(e => /^ppt\/slides\/slide\d+\.xml$/i.test(e.name))
        .sort((a,b) => Number(a.name.match(/slide(\d+)/i)[1]) - Number(b.name.match(/slide(\d+)/i)[1]));
      const chunks = [];
      const all = [];
      for (let i=0; i<slides.length; i++) {
        const xml = slides[i].buffer.toString("utf8");
        const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m => m[1]
          .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'")).join(" ");
        if (text.trim()) {
          all.push(`Slide ${i+1}\n${text}`);
          chunks.push(...splitChunks(text, `Slide ${i+1}`));
        }
      }
      return { text: all.join("\n\n"), chunks };
    } finally { await fs.unlink(tmp).catch(()=>{}); }
  }
  if ([".xlsx", ".csv"].includes(ext)) {
    const chunks = [];
    const all = [];
    const sheets = ext === ".csv"
      ? [{ name: "CSV", text: parseCsv(buffer) }]
      : parseXlsxEntries(await readZipEntriesFromBuffer(buffer, { count: 500, bytes: 40 * 1024 * 1024 }));
    for (const sheet of sheets) {
      all.push(`Sheet: ${sheet.name}\n${sheet.text}`);
      chunks.push(...splitChunks(sheet.text, `Sheet ${sheet.name}`));
    }
    return { text: all.join("\n\n"), chunks };
  }
  if (ext === ".zip") {
    const entries = await readZipEntriesFromBuffer(buffer);
    const chunks = [];
    const all = [];
    for (const entry of entries) {
      const inner = await extractBuffer(entry.name, entry.buffer);
      if (inner.text) {
        all.push(`Archive file: ${entry.name}\n${inner.text}`);
        chunks.push(...inner.chunks.map(c => ({ ...c, locator: `${entry.name} / ${c.locator}` })));
      }
    }
    return { text: all.join("\n\n"), chunks };
  }
  if (ext === ".odt") {
    const tmp = path.join(os.tmpdir(), `odt-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`);
    await fs.writeFile(tmp, buffer);
    try {
      const entries = await readZipEntries(tmp, { count: 300, bytes: 30 * 1024 * 1024 });
      const content = entries.find(e => e.name === "content.xml")?.buffer.toString("utf8") || "";
      const text = content.replace(/<text:p[^>]*>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
      return { text, chunks: splitChunks(text, "ODT paragraph") };
    } finally { await fs.unlink(tmp).catch(()=>{}); }
  }
  if (textExtensions.has(ext)) {
    let text = buffer.toString("utf8");
    if ([".html", ".htm"].includes(ext)) text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<\/(p|div|h[1-6]|li|br)>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").trim();
    return { text, chunks: splitChunks(text) };
  }
  if (imageMimes.has(mimeType) || [".png",".jpg",".jpeg",".webp",".gif"].includes(ext)) {
    let text = `[Image file: ${name}. Visual understanding is available when this image is attached to a chat and the configured model supports vision.]`;
    if (config.enableOcr && !["image/gif"].includes(mimeType)) {
      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker(config.ocrLanguages || "eng+ben");
        try { const result = await worker.recognize(buffer); if (result.data.text?.trim()) text += `\n\nOCR text (${config.ocrLanguages || "eng+ben"}):\n${result.data.text.trim()}`; }
        finally { await worker.terminate(); }
      } catch (error) { text += `\n[OCR unavailable: ${error.message}]`; }
    }
    return { text, chunks: splitChunks(text, "Image OCR") };
  }
  return { text: `No text extractor is configured for ${ext || "this file type"}.`, chunks: [] };
}

async function readZipEntriesFromBuffer(buffer, limits) {
  const tmp = path.join(os.tmpdir(), `archive-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`);
  await fs.writeFile(tmp, buffer);
  try { return await readZipEntries(tmp, limits); }
  finally { await fs.unlink(tmp).catch(()=>{}); }
}

export async function processFile(file) {
  const buffer = file.buffer || await fs.readFile(file.path);
  return extractBuffer(file.originalname, buffer, file.mimetype);
}

export { imageMimes };
