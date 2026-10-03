export type ErrorCode =
  | "VALIDATION"
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
  | "CSRF"
  | "BLOCKED"
  | "CONFLICT"
  | "SERVER";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  INVALID_SESSION: 401,
  FORBIDDEN: 403,
  CSRF: 403,
  BLOCKED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ALREADY_CLAIMED: 409,
  NOT_COMPLETED: 409,
  INSUFFICIENT_COINS: 402,
  CASE_UNAVAILABLE: 410,
  RATE_LIMITED: 429,
  COOLDOWN: 429,
  MAINTENANCE: 503,
  SERVER: 500,
};

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
