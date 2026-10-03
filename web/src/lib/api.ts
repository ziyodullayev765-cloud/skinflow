export type ApiErrorCode =
  | "NETWORK"
  | "SERVER"
  | "UNAUTHORIZED"
  | "INVALID_SESSION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INSUFFICIENT_COINS"
  | "RATE_LIMITED"
  | "COOLDOWN"
  | "CASE_UNAVAILABLE"
  | "ALREADY_CLAIMED"
  | "NOT_COMPLETED"
  | "MAINTENANCE"
  | "VALIDATION"
  | "CSRF"
  | "BLOCKED"
  | "CONFLICT";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 0,
    public details?: unknown,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  authToken = t;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  auth?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("NETWORK", "No connection. Check your internet and try again.");
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const err = data?.error;
    const code: ApiErrorCode = err?.code ?? (res.status >= 500 ? "SERVER" : res.status === 429 ? "RATE_LIMITED" : "SERVER");
    const retryAfter = err?.retryAfter ?? (Number(res.headers.get("Retry-After")) || undefined);
    const apiErr = new ApiError(code, err?.message ?? "Something went wrong. Please try again.", res.status, err?.details, retryAfter);
    if ((code === "INVALID_SESSION" || code === "UNAUTHORIZED") && opts.auth !== false && onUnauthorized) onUnauthorized();
    throw apiErr;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
};
