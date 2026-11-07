import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/api/errors";

/**
 * Maps backend field-level validation errors (HTTP 422) onto form fields via
 * react-hook-form's setError. Client validation is a UX aid only (AGENTS.md §7).
 *
 * `allowedFields` is the form's own field list — server errors for unknown
 * fields are surfaced as a message, not silently attached to a wrong field.
 */
export function mapFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  allowedFields: readonly (keyof T)[],
): boolean {
  if (!(error instanceof ApiError)) return false;
  const fields = error.fieldErrors;
  if (!fields || error.status !== 422) return false;

  let mapped = false;
  const known = allowedFields.map(String);
  for (const [field, message] of Object.entries(fields)) {
    if (known.includes(field)) {
      setError(field as Path<T>, { type: "server", message });
      mapped = true;
    }
  }
  return mapped;
}
