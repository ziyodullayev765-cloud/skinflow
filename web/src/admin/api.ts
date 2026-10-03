import { ApiError, type ApiErrorCode } from "../lib/api";

let csrfToken = "";
let onUnauthorized: (() => void) | null = null;

export function setCsrf(t: string) {
  csrfToken = t;
}
export function setAdminUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const e = data?.error;
    const code = (e?.code ?? (res.status >= 500 ? "SERVER" : "VALIDATION")) as ApiErrorCode;
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    throw new ApiError(code, e?.message ?? `Request failed (${res.status})`, res.status, e?.details, e?.retryAfter);
  }
  return data as T;
}

export async function adminRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("NETWORK", "Network error — check your connection.");
  }
  return handle<T>(res);
}

export async function uploadImage(file: File): Promise<UploadResult> {
  let res: Response;
  try {
    res = await fetch("/api/admin/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": file.type, "X-CSRF-Token": csrfToken },
      body: file,
    });
  } catch {
    throw new ApiError("NETWORK", "Network error — check your connection.");
  }
  return (await handle<{ upload: UploadResult }>(res)).upload;
}

export const adminApi = {
  get: <T>(p: string) => adminRequest<T>(p),
  post: <T>(p: string, b: unknown = {}) => adminRequest<T>(p, "POST", b),
  put: <T>(p: string, b: unknown) => adminRequest<T>(p, "PUT", b),
  patch: <T>(p: string, b: unknown) => adminRequest<T>(p, "PATCH", b),
  del: <T>(p: string) => adminRequest<T>(p, "DELETE"),
};

export interface UploadResult {
  id: string;
  originalUrl: string;
  optimizedUrl: string;
  thumbnailUrl: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  hasAlpha: boolean;
}

export interface AdminSkin {
  id: number;
  slug: string;
  name: string;
  weaponName: string;
  weaponType: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  image: string;
  thumbnail: string;
  imageUrl: string;
  optimizedImageUrl: string | null;
  thumbnailUrl: string | null;
  description: string;
  virtualPrice: number;
  collectionId: number | null;
  collection: string;
  active: boolean;
  featured: boolean;
  createdAt: string;
  owners?: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
