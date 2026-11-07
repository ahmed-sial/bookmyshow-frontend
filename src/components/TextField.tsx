import { useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

export interface TextFieldProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "ref"
> {
  label: string;
  error?: string;
  /** Return value of `register(name)` — wires value/onChange/onBlur/name. */
  registration: UseFormRegisterReturn;
  /** Adds a Show/Hide password toggle; use on type="password" fields. */
  passwordToggle?: boolean;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  // Both paths of one eye glyph: slit line when covered ("hide" state).
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {hidden ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

/**
 * Labelled text input with an associated error message and ARIA wiring
 * (AGENTS.md §10: every field has a label and an associated error).
 *
 * `registration` (from react-hook-form's `register`) already supplies the
 * input's `ref`, so no separate forwarded ref is needed.
 *
 * `passwordToggle` renders a Show/Hide button that flips the input's type;
 * the toggle is a real button with aria-pressed so it stays keyboard
 * operable and announced.
 */
export function TextField({
  label,
  error,
  registration,
  id,
  type = "text",
  passwordToggle,
  ...rest
}: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputType = passwordToggle ? (visible ? "text" : "password") : type;

  const inputId = id ?? registration.name;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-screen">
        {label}
      </label>
      <div className={passwordToggle ? "relative" : undefined}>
        <input
          id={inputId}
          type={inputType}
          aria-invalid={error !== undefined}
          aria-describedby={errorId}
          className={`w-full rounded-md border bg-seat px-3 py-2 text-sm text-screen placeholder:text-reel/60 ${
            passwordToggle ? "pr-10" : ""
          } ${
            error !== undefined
              ? "border-ember/70 focus:border-ember focus:ring-1 focus:ring-ember"
              : "border-reel/25 focus:border-marquee focus:outline-none focus:ring-1 focus:ring-marquee"
          }`}
          {...registration}
          {...rest}
        />
        {passwordToggle ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md text-reel hover:text-screen focus-visible:outline focus-visible:outline-2 focus-visible:outline-marquee"
          >
            <EyeIcon hidden={visible} />
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-ember">
          {error}
        </p>
      ) : null}
    </div>
  );
}
