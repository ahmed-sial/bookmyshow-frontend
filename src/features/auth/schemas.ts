import { z } from "zod";

/**
 * Client-side validation mirrors the backend's rules (identity DTO validate
 * tags / users table constraints) so the user sees good errors immediately;
 * the server remains authoritative (AGENTS.md §7).
 */

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  // The backend validates min 8 / max 72 on login too.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be at most 72 characters."),
});

export const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name.")
    .max(50, "First name must be at most 50 characters."),
  lastName: z
    .string()
    .trim()
    .max(50, "Last name must be at most 50 characters."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(255, "Email must be at most 255 characters."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be at most 72 characters.")
    // Mirrors the backend's password character-class rule so the request
    // never leaves the browser when the format is wrong.
    .refine(
      (value) => /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value),
      "Password must contain an uppercase letter, a lowercase letter, and a digit.",
    ),
  phoneNumber: z
    .string()
    .regex(
      /^\+[1-9][0-9]{7,14}$/,
      "Enter your phone in international format, e.g. +923331234567.",
    ),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
