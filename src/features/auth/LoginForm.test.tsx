import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";
import { useSession } from "./session";
import { ApiError } from "@/api/errors";

vi.mock("./session", () => ({
  useSession: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

import { useNavigate } from "react-router-dom";

const mockSignIn = vi.fn();
const mockNavigate = vi.fn();

const user = userEvent.setup();

beforeEach(() => {
  mockSignIn.mockReset();
  mockNavigate.mockReset();
  (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
    signIn: mockSignIn,
    accessToken: null,
  });
  (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderLogin() {
  return render(<LoginForm />);
}

async function submitForm() {
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginForm", () => {
  it("shows field-level validation errors on empty submit", async () => {
    renderLogin();
    await submitForm();

    expect(
      screen.getByText(/enter a valid email address/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/password must be at least 8 characters/i),
    ).toBeInTheDocument();
  });

  it("calls signIn with email and password on valid submit", async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1234" },
    });
    await submitForm();

    await vi.waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "secret1234");
    });
  });

  it("navigates to / on successful sign in", async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1234" },
    });
    await submitForm();

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("shows 'Invalid email or password' on 401", async () => {
    mockSignIn.mockRejectedValueOnce(
      new ApiError({ status: 401, message: "Invalid credentials" }),
    );
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1234" },
    });
    await submitForm();

    await vi.waitFor(() => {
      expect(
        within(screen.getByRole("alert")).getByText(
          /invalid email or password/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows rate-limit message on 429", async () => {
    mockSignIn.mockRejectedValueOnce(
      new ApiError({ status: 429, message: "Too many requests" }),
    );
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1234" },
    });
    await submitForm();

    await vi.waitFor(() => {
      expect(
        within(screen.getByRole("alert")).getByText(/too many attempts/i),
      ).toBeInTheDocument();
    });
  });

  it("shows a generic error for non-ApiError failures", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("network down"));
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1234" },
    });
    await submitForm();

    await vi.waitFor(() => {
      expect(
        within(screen.getByRole("alert")).getByText(/something went wrong/i),
      ).toBeInTheDocument();
    });
  });

  it("toggles password visibility with the show/hide button", async () => {
    renderLogin();

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    // The same button flips back to hidden and renames itself.
    const hideToggle = screen.getByRole("button", { name: "Hide password" });
    await user.click(hideToggle);

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(hideToggle).toHaveAttribute("aria-pressed", "false");
  });
});
