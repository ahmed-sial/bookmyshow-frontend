/**
 * Normalizes backend failures into a typed ApiError.
 *
 * The frontend spec mandates the envelope `{ error: { code, message, request_id } }`,
 * but the backend currently sends `{ error: "<message>" }` (plain string) and
 * `{ errors: { field: message } }` for validation failures. Per the agreed
 * temporary adapter, the parser below accepts both shapes; when the backend
 * adopts the nested envelope this module needs no changes.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  /** Field-level validation errors (HTTP 422), keyed by request field name. */
  readonly fieldErrors?: Readonly<Record<string, string>>;

  constructor(options: {
    status: number;
    message: string;
    code?: string;
    requestId?: string;
    fieldErrors?: Readonly<Record<string, string>>;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.fieldErrors = options.fieldErrors;
  }
}

/** True while `value` is a plain (non-null, non-array) object. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function recordOfStrings(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(record)) {
    if (typeof val === "string") out[key] = val;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export interface NormalizedError {
  message?: string;
  code?: string;
  requestId?: string;
  fieldErrors?: Readonly<Record<string, string>>;
}

/**
 * Parses an error response body into its normalized parts. Never throws:
 * unparseable bodies fall back to a generic message.
 */
export function normalizeErrorPayload(payload: unknown): NormalizedError {
  const record = asRecord(payload);
  const errorField = record?.["error"];
  const nested = asRecord(errorField);

  // Spec envelope: { error: { code, message, request_id } }
  if (nested) {
    return {
      message:
        typeof nested["message"] === "string" ? nested["message"] : undefined,
      code: typeof nested["code"] === "string" ? nested["code"] : undefined,
      requestId:
        typeof nested["request_id"] === "string"
          ? nested["request_id"]
          : undefined,
      fieldErrors: recordOfStrings(record?.["errors"]),
    };
  }

  // Current backend: { error: "message" } (and optionally { errors: {...} })
  if (typeof errorField === "string") {
    return {
      message: errorField,
      requestId:
        typeof record?.["request_id"] === "string"
          ? record["request_id"]
          : undefined,
      fieldErrors: recordOfStrings(record?.["errors"]),
    };
  }

  // Fallbacks: { message: "..." } at top level, or nothing usable.
  return {
    message:
      typeof record?.["message"] === "string" ? record["message"] : undefined,
    fieldErrors: recordOfStrings(record?.["errors"]),
  };
}
