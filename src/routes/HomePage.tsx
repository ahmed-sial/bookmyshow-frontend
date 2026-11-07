import { Link, Outlet } from "react-router-dom";
import { useSession } from "@/features/auth/session";

/**
 * Temporary home placeholder. Discovery (movies/showtimes) lands in F1;
 * for now it only proves the auth states read and write correctly.
 */
export function HomePage() {
  const { user, signOut } = useSession();

  return (
    <main className="min-h-screen px-4">
      <header className="mx-auto flex max-w-3xl items-center justify-between py-5">
        <Link to="/" className="font-display text-xl leading-none text-screen">
          BookMyShow
        </Link>
        {user ? (
          <button type="button" onClick={signOut} className="link-accent">
            Sign out
          </button>
        ) : (
          <Link to="/login" className="link-accent">
            Sign in
          </Link>
        )}
      </header>
      <Outlet />
      <section className="mx-auto max-w-3xl py-16">
        <h1 className="font-display text-3xl text-screen">
          Browse movies and book tickets
        </h1>
        {user ? (
          <p className="mt-4 text-reel">Signed in as {user.email}</p>
        ) : (
          <p className="mt-4 max-w-lg text-reel">
            Movie listings are coming soon.{" "}
            <Link to="/register" className="link-accent">
              Create an account
            </Link>{" "}
            to be ready when bookings open.
          </p>
        )}
      </section>
    </main>
  );
}
