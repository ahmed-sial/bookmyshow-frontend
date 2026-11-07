/**
 * Hand-written API types kept in one place so they are easy to replace with
 * generated types once the backend ships an OpenAPI file (AGENTS.md §8).
 */

export interface RegisterInput {
  firstName: string;
  /** Optional; the backend treats blank as absent. */
  lastName?: string;
  email: string;
  password: string;
  /** E.164-style international number, e.g. +923331234567. */
  phoneNumber: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UserDto {
  id: string;
  firstName: string;
  /** Omitted or empty when the user has no last name. */
  lastName?: string | null;
  email: string;
  phoneNumber: string;
}

export interface LoginResponse extends UserDto {
  /** Short-lived JWT access token; the backend has no refresh flow yet. */
  token: string;
}
