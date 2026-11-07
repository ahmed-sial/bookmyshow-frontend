/** Auth API calls. Thin wrappers over the shared client so forms stay simple. */

import { request } from "@/api/client";
import type { LoginInput, LoginResponse, RegisterInput } from "@/api/types";

const AUTH_PATH = "/identity/auth";

export function registerUser(input: RegisterInput): Promise<void> {
  // Returns 201 with an empty body on success.
  return request<void>(`${AUTH_PATH}/register`, {
    method: "POST",
    body: input,
  });
}

export function loginUser(input: LoginInput): Promise<LoginResponse> {
  return request<LoginResponse>(`${AUTH_PATH}/login`, {
    method: "POST",
    body: input,
  });
}
