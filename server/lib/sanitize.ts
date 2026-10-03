import { z } from "zod";

/** Strips control characters and angle brackets; trims whitespace. React escapes output too — this is defence in depth. */
export function cleanText(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[<>]/g, "").trim();
}

export const safeText = (min: number, max: number) =>
  z.string().transform(cleanText).pipe(z.string().min(min).max(max));

/** Allowed image references: app-relative assets/uploads or https URLs. */
export const imageRef = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/(assets|api\/files|api\/media)\/[A-Za-z0-9._\-/]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v), "Invalid image URL");

export const idParam = z.coerce.number().int().positive().max(2_147_483_647);
