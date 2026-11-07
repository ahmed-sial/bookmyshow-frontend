import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { SessionProvider } from "@/features/auth/session";
import { ErrorBoundary } from "./ErrorBoundary";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      // Auth mutations are not retried blindly (AGENTS.md §8: never auto-retry
      // non-idempotent mutations unless they carry an idempotency key).
      retry: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </SessionProvider>
    </QueryClientProvider>
  );
}
