import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { HomePage } from "@/routes/HomePage";
import { LiveMessage } from "@/components/FormMessage";

// Route modules are lazy-loaded so the customer bundle stays small (spec §16).
// Staff console routes come later with the /admin area (spec §3).
const LoginPage = lazy(() =>
  import("@/features/auth/LoginForm").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/features/auth/RegisterForm").then((m) => ({
    default: m.RegisterPage,
  })),
);

function RouteFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-auditorium"
      role="status"
    >
      <LiveMessage>Loading page</LiveMessage>
      <p className="text-sm text-reel">Loading…</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
    children: [{ index: true, element: <Navigate to="/" replace /> }],
  },
  {
    path: "/login",
    element: (
      <Suspense fallback={<RouteFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "/register",
    element: (
      <Suspense fallback={<RouteFallback />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
