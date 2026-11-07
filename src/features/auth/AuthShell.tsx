import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Shared card shell for the auth screens (login / register / future recovery).
 *
 * The card reads as a cinema ticket: the header ("stub") is separated from
 * the form section by a dashed perforation line with two punched notches on
 * the card edges. The perforation encodes structure (stub = identity, body =
 * form) rather than decoration, and the wordmark + headline are the only
 * display type on the page.
 */
export function AuthShell({
  title,
  footer,
  children,
}: {
  title: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-auditorium px-4 py-10">
      <div className="curtain-in w-full max-w-md rounded-2xl border border-reel/25 bg-seat">
        <header className="px-8 pb-6 pt-8">
          <p className="font-display text-xl leading-none text-screen">
            BookMyShow
          </p>
          <h1 className="mt-7 font-display text-3xl leading-none tracking-wide text-screen">
            {title}
          </h1>
        </header>
        {/* Perforation: dashed tear line with punched notches on both edges. */}
        <div className="relative border-t border-dashed border-reel/40">
          <span
            aria-hidden="true"
            className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-reel/40 bg-auditorium"
          />
          <span
            aria-hidden="true"
            className="absolute -right-3 -top-3 h-6 w-6 rounded-full border border-reel/40 bg-auditorium"
          />
        </div>
        <div className="flex flex-col gap-4 px-8 py-7">{children}</div>
        <div className="border-t border-reel/15 px-8 py-5 text-sm text-reel">
          {footer}
        </div>
      </div>
    </main>
  );
}

export function authLink(to: string, text: string): ReactNode {
  return (
    <Link to={to} className="link-accent">
      {text}
    </Link>
  );
}
