import { randomUUID } from "node:crypto";
import path from "node:path";

const FILE_LIMIT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function extensionFor(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  return ext;
}

function sniffMime(file) {
  const data = file.buffer;
  if (data.length >= 5 && data.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04 && extensionFor(file) === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (extensionFor(file) === ".csv") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
      if (!text.includes("\u0000")) return "text/csv";
    } catch {
      return null;
    }
  }
  return null;
}

export function validateUpload(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) return { ok: false, reason: "missing" };
  if (file.size > FILE_LIMIT_BYTES) return { ok: false, reason: "too_large" };
  const mime = sniffMime(file);
  const extensionTypes = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  if (!mime || !ALLOWED_TYPES.has(mime) || extensionTypes[extensionFor(file)] !== mime) {
    return { ok: false, reason: "unsupported_type" };
  }
  const originalName = path.basename(String(file.originalname || "attachment"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200) || "attachment";
  return { ok: true, mime, originalName, size: file.size };
}

function platformUrl(pathname, key) {
  const base = String(process.env.MANUS_API_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.MANUS_API_KEY;
  if (!base || !apiKey) throw new Error("Managed file storage is not configured.");
  const url = new URL(`${base}/v1/storage/presign/${pathname}`);
  url.searchParams.set("path", key);
  return { url, apiKey };
}

async function getPresignedUrl(action, key) {
  const { url, apiKey } = platformUrl(action, key);
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Managed file storage request failed (${response.status}).`);
  const payload = await response.json();
  if (payload.error || typeof payload.url !== "string") throw new Error("Managed file storage did not return a transfer URL.");
  return payload.url;
}

export async function uploadReportAttachment(reportId, file, validation) {
  const extension = extensionFor(file).replace(/[^a-z0-9.]/g, "");
  const key = `ddf-tracking/reports/${reportId}/${randomUUID()}${extension}`;
  const signedUrl = await getPresignedUrl("put", key);
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": validation.mime },
    body: file.buffer,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Managed file upload failed (${response.status}).`);
  return { key, stablePath: `/manus-storage/${key}` };
}

export async function downloadReportAttachment(key) {
  const signedUrl = await getPresignedUrl("get", key);
  const response = await fetch(signedUrl, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Managed file download failed (${response.status}).`);
  return response;
}

export const uploadLimits = Object.freeze({ fileBytes: FILE_LIMIT_BYTES, filesPerReport: 5, allowedTypes: [...ALLOWED_TYPES] });
