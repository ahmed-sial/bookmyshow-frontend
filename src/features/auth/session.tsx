import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RegisterInput } from "@/api/types";
import { loginUser, registerUser } from "./api";
import type { LoginResponse } from "@/api/types";

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

interface SessionValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  /** Logs the user in; throws ApiError on failure. */
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Registers a new account, then immediately signs in with the same
   * credentials (the backend returns 201 with no body, so this is the only
   * way to land the user on an authenticated page).
   */
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => void;
  /**
   * Access token, kept in memory only. Never persisted — the backend has no
   * refresh endpoint yet, so a page reload requires signing in again.
   */
  accessToken: string | null;
}

const SessionContext = createContext<SessionValue | null>(null);

function toSessionUser(dto: LoginResponse): SessionUser {
  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName ?? "",
    email: dto.email,
    phoneNumber: dto.phoneNumber,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await loginUser({ email, password });
    setUser(toSessionUser(response));
    setAccessToken(response.token);
  }, []);

  const signUp = useCallback(
    async (input: RegisterInput) => {
      await registerUser(input);
      await signIn(input.email, input.password);
    },
    [signIn],
  );

  const signOut = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    // The backend does not expose DELETE /auth/logout yet; clearing our
    // in-memory session is all we can do until it does.
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn,
      signUp,
      signOut,
      accessToken,
    }),
    [user, signIn, signUp, signOut, accessToken],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
