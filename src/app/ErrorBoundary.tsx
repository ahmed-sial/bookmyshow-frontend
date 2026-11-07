import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level render-error boundary with a plain fallback (spec §10).
 *
 * This must be a class component: React 18 has no functional equivalent for
 * lifecycle methods getDerivedStateFromError / componentDidCatch.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // Rendering errors are unexpected by definition; give diagnostics a hook.
    console.error("Unhandled render error", error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center px-4 bg-auditorium">
          <div className="max-w-md text-center">
            <h1 className="font-display text-2xl text-screen">
              Something went wrong
            </h1>
            <p className="mt-3 text-reel">
              An unexpected error occurred while rendering the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary mt-5 w-auto"
            >
              Reload
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
