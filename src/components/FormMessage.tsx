import type { ReactNode } from "react";

/**
 * Renders an unexpected failure with its trace reference when the backend
 * provides one (AGENTS.md §8: show `request_id` in unexpected-error UI).
 * Expected failures (invalid credentials, validation) are handled inline in
 * the forms and never routed here.
 */
export function FormError({
  message,
  requestId,
}: {
  message: string;
  requestId?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-ember"
    >
      <p>{message}</p>
      {requestId ? (
        <p className="mt-1 text-xs text-reel/70">Reference: {requestId}</p>
      ) : null}
    </div>
  );
}

/** Live-region wrapper so status changes are announced without stealing focus. */
export function LiveMessage({ children }: { children: ReactNode }) {
  return (
    <p aria-live="polite" className="sr-only">
      {children}
    </p>
  );
}
