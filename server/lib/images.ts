import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { ApiError } from "./errors.js";
import { putObject } from "./storage.js";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
type Mime = (typeof ALLOWED_MIME)[number];

const EXT: Record<Mime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Magic-byte sniffing: the declared Content-Type must match the actual file. */
export function sniffMime(b: Buffer): Mime | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  optimizedUrl: string;
  thumbnailUrl: string;
  mime: Mime;
  size: number;
  width: number;
  height: number;
  hasAlpha: boolean;
}

/**
 * 1. validate type  2. validate size  3. resize if necessary
 * 4. convert to WebP  5. generate thumbnail  6. store all versions
 */
export async function processSkinImage(buf: Buffer, declaredMime: string): Promise<ProcessedImage> {
  if (!buf.length) throw new ApiError("VALIDATION", "Empty file");
  if (buf.length > MAX_UPLOAD_BYTES) throw new ApiError("VALIDATION", `Image must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller`);
  const mime = sniffMime(buf);
  if (!mime) throw new ApiError("VALIDATION", "Only PNG, JPG or WEBP images are allowed");
  if (declaredMime && declaredMime !== mime) throw new ApiError("VALIDATION", "File content does not match its image type");

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buf, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new ApiError("VALIDATION", "The image could not be read");
  }
  if (!meta.width || !meta.height) throw new ApiError("VALIDATION", "The image could not be read");
  if (meta.width < 64 || meta.height < 64) throw new ApiError("VALIDATION", "Image is too small (min 64×64)");

  const base = sharp(buf, { limitInputPixels: 40_000_000 }).rotate();
  const [optimized, thumbnail] = await Promise.all([
    base.clone().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90, effort: 4 }).toBuffer(),
    base.clone().resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true }).webp({ quality: 76, alphaQuality: 85, effort: 4 }).toBuffer(),
  ]);

  const id = randomBytes(10).toString("hex");
  const prefix = `skins/${id}`;
  const [originalUrl, optimizedUrl, thumbnailUrl] = await Promise.all([
    putObject(`${prefix}/original.${EXT[mime]}`, buf, mime),
    putObject(`${prefix}/optimized.webp`, optimized, "image/webp"),
    putObject(`${prefix}/thumb.webp`, thumbnail, "image/webp"),
  ]);
  return { id, originalUrl, optimizedUrl, thumbnailUrl, mime, size: buf.length, width: meta.width, height: meta.height, hasAlpha: !!meta.hasAlpha };
}
