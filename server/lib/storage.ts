import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./errors.js";

/**
 * Object storage for uploaded images. Files never go into PostgreSQL —
 * only their public URLs do.
 *  - Vercel Blob (CDN-backed) when BLOB_READ_WRITE_TOKEN is set (production)
 *  - Local disk served at /api/files/* for development / self-hosting
 */
export const LOCAL_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

export function storageDriver(): "blob" | "local" | "none" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL) return "none"; // read-only, ephemeral filesystem
  return "local";
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  const driver = storageDriver();
  if (driver === "blob") {
    const { put } = await import("@vercel/blob");
    const res = await put(key, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 31536000,
    });
    return res.url;
  }
  if (driver === "local") {
    const file = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body, { flag: "wx" });
    return `/api/files/${key}`;
  }
  throw new ApiError("SERVER", "Image storage is not configured. Connect a Vercel Blob store (BLOB_READ_WRITE_TOKEN).");
}
