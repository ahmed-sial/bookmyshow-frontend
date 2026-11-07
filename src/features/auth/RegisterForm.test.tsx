import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "./RegisterForm";
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

const mockSignUp = vi.fn();
const mockNavigate = vi.fn();

const user = userEvent.setup();

beforeEach(() => {
  mockSignUp.mockReset();
  mockNavigate.mockReset();
  (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
    signUp: mockSignUp,
    accessToken: null,
  });
  (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderRegister() {
  return render(<RegisterForm />);
}

async function submitForm() {
  await user.click(screen.getByRole("button", { name: /create account/i }));
}

function fillValidRegister() {
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: "Lovelace" },
  });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Secret1234" },
  });
  fireEvent.change(screen.getByLabelText(/phone number/i), {
    target: { value: "+923331234567" },
  });
}

describe("RegisterForm", () => {
  it("shows field-level validation errors on empty submit", async () => {
    renderRegister();
    await submitForm();

    expect(screen.getByText(/enter your first name/i)).toBeInTheDocument();
    expect(
      screen.getByText(/enter a valid email address/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/password must be at least 8 characters/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/enter your phone in international format/i),
    ).toBeInTheDocument();
  });

  it("shows password-format error client-side without calling signUp", async () => {
    renderRegister();
    fillValidRegister();
    // Valid per min/max but missing an uppercase letter (mirror of the case
    // the backend used to reject after a round trip).
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "weakpassword9" },
    });
    await submitForm();

    expect(
      screen.getByText(
        /password must contain an uppercase letter, a lowercase letter, and a digit/i,
      ),
    ).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("calls signUp with trimmed values on valid submit", async () => {
    renderRegister();
    fillValidRegister();
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Lovelace " },
    });
    await submitForm();

    await vi.waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "Secret1234",
        phoneNumber: "+923331234567",
      });
    });
  });

  it("omits lastName when blank", async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Secret1234" },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "+923331234567" },
    });
    await submitForm();

    await vi.waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        firstName: "Ada",
        email: "ada@example.com",
        password: "Secret1234",
        phoneNumber: "+923331234567",
      });
    });
  });

  it("navigates to / on successful registration", async () => {
    mockSignUp.mockResolvedValueOnce(undefined);
    renderRegister();
    fillValidRegister();
    await submitForm();

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("shows 'account already exists' on 409 email conflict", async () => {
    mockSignUp.mockRejectedValueOnce(
      new ApiError({ status: 409, message: "Email already registered" }),
    );
    renderRegister();
    fillValidRegister();
    await submitForm();

    await vi.waitFor(() => {
      expect(
        within(screen.getByRole("alert")).getByText(
          /an account with this email already exists/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows 'phone already exists' on 409 phone conflict", async () => {
    mockSignUp.mockRejectedValueOnce(
      new ApiError({ status: 409, message: "Phone number in use" }),
    );
    renderRegister();
    fillValidRegister();
    await submitForm();

    await vi.waitFor(() => {
      expect(
        within(screen.getByRole("alert")).getByText(
          /an account with this phone number already exists/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows a generic error for non-409 failures", async () => {
    mockSignUp.mockRejectedValueOnce(
      new ApiError({ status: 500, message: "server error", requestId: "abc" }),
    );
    renderRegister();
    fillValidRegister();
    await submitForm();

    await vi.waitFor(() => {
      expect(
        within(screen.getByRole("alert")).getByText(/something went wrong/i),
      ).toBeInTheDocument();
    });
  });
});
