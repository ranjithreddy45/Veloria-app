// ============================================================
// Every error the Push API can return, with its HTTP status in one place so a
// code can never be sent with two different statuses from two call sites.
// ============================================================

export const PUSH_API_ERRORS = {
  UNAUTHORIZED: 401,
  API_KEY_REVOKED: 403,
  API_KEY_EXPIRED: 403,
  INSUFFICIENT_SCOPE: 403,
  /** The body's `source` isn't the source this key was issued for. */
  SOURCE_NOT_ALLOWED: 403,
  /** The request reached us over plain HTTP. */
  HTTPS_REQUIRED: 403,
  PUSH_API_DISABLED: 503,
  INVALID_JSON: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  VALIDATION_ERROR: 422,
  INVALID_IDEMPOTENCY_KEY: 400,
  IDEMPOTENCY_KEY_REUSED: 409,
  IDEMPOTENCY_KEY_IN_PROGRESS: 409,
  RATE_LIMITED: 429,
  /** Too many failed authentication attempts from one IP address. */
  TOO_MANY_FAILED_ATTEMPTS: 429,
  /** The key has created its daily maximum of new leads. */
  LEAD_CAP_REACHED: 429,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
} as const;

export type PushApiErrorCode = keyof typeof PUSH_API_ERRORS;

export class PushApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: PushApiErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = "PushApiError";
    this.status = PUSH_API_ERRORS[code];
  }
}
