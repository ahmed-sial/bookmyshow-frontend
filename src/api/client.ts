/**
 * The single HTTP client for the app (AGENTS.md §8).Components never call
 * `fetch` directly. It sets the base URL, JSON-encodes bodies, applies a
 * default timeout via AbortController, and throws ApiError on failure.
 */

import { ApiError, normalizeErrorPayload } from "./errors";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
/** Hard cap per request; prompts stay responsive when the backend hangs. */
const DEFAULT_TIMEOUT_MS = 10_000;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  /** Request payload; JSON-encoded. Omit for bodyless requests. */
  body?: unknown;
  /** Attached as `Authorization: Bearer <token>` when present. */
  accessToken?: string;
  /** Caller abort signal (e.g. navigation-aware requests). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    accessToken,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Combine the caller's signal with our own timeout signal.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal2 = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: signal2,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    // The caller aborted on purpose: propagate, don't masquerade as a timeout.
    if (signal?.aborted) throw error;
    throw new ApiError({ status: 0, message: "Request timed out" });
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Empty or non-JSON error body; the fallback message covers it.
    }
    const normalized = normalizeErrorPayload(payload);
    throw new ApiError({
      status: response.status,
      message:
        normalized.message ?? `Request failed with status ${response.status}`,
      code: normalized.code,
      requestId: normalized.requestId,
      fieldErrors: normalized.fieldErrors,
    });
  }

  // 201 Created and 204 No Content may have an empty body; parsing it as
  // JSON throws. Return undefined for those so callers (e.g. registerUser)
  // can proceed to the next step instead of surfacing a spurious error.
  if (response.status === 204 || response.status === 201) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
