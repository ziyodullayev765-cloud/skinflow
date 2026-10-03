import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./errors.js";

/**
 * Object storage for uploaded images. Files never go into PostgreSQL —
 * only their public URLs do.
 *  - Vercel Blob (CDN-backed) when BLOB_STORE_ID (OIDC, current Vercel default)
 *    or BLOB_READ_WRITE_TOKEN (legacy token) is set
 *  - Local disk served at /api/files/* for development / self-hosting
 */
export const LOCAL_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

export function isSafeKey(key: string): boolean {
  return /^[a-z0-9/_.-]+$/i.test(key) && !key.includes("..") && !key.startsWith("/");
}

/** Streams a private Blob object (used when the store is private). */
export async function getPrivateObject(key: string) {
  const { get } = await import("@vercel/blob");
  const res = await get(key, { access: "private" });
  if (!res || res.statusCode !== 200) return null;
  return { stream: res.stream, contentType: res.blob.contentType, size: res.blob.size };
}

export function blobAccessMode() {
  return blobAccess;
}

export function storageDriver(): "blob" | "local" | "none" {
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL) return "none"; // read-only, ephemeral filesystem
  return "local";
}

/** Detected access mode of the connected Blob store (new Vercel stores are often private). */
let blobAccess: "public" | "private" | null = (process.env.BLOB_ACCESS as "public" | "private" | undefined) ?? null;

export const MEDIA_PREFIX = "/api/media/";

export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!isSafeKey(key)) throw new Error("Invalid storage key");
  const driver = storageDriver();
  if (driver === "blob") {
    const { put } = await import("@vercel/blob");
    const upload = (access: "public" | "private") =>
      put(key, body, { access, contentType, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 31536000 });
    if (blobAccess !== "private") {
      try {
        const res = await upload("public");
        blobAccess = "public";
        return res.url;
      } catch (err) {
        // A private store rejects public uploads — switch to private and serve through /api/media.
        if (!/private|access/i.test((err as Error).message)) throw err;
        blobAccess = "private";
      }
    }
    await upload("private");
    return `${MEDIA_PREFIX}${key}`;
  }
  if (driver === "local") {
    const file = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body, { flag: "wx" });
    return `/api/files/${key}`;
  }
  throw new ApiError("SERVER", "Image storage is not configured. Connect a Vercel Blob store to the project (BLOB_STORE_ID) and redeploy.");
}
