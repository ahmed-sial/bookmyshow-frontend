import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/api/errors";
import { FormError, LiveMessage } from "@/components/FormMessage";
import { TextField } from "@/components/TextField";
import { useSession } from "./session";
import { registerSchema, type RegisterValues } from "./schemas";
import { mapFieldErrors } from "./mapFieldErrors";
import { AuthShell, authLink } from "./AuthShell";

/** Friendly copy for the backend's 409 conflict messages. */
function conflictMessage(message: string): string {
  if (message.toLowerCase().includes("email")) {
    return "An account with this email already exists.";
  }
  if (message.toLowerCase().includes("phone")) {
    return "An account with this phone number already exists.";
  }
  return message;
}

/**
 * Registration screen. On success the user is signed in automatically with
 * the credentials just submitted (registration returns 201 with no body).
 */
export function RegisterForm() {
  const navigate = useNavigate();
  const { signUp } = useSession();
  const [formError, setFormError] = useState<{
    message: string;
    requestId?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const FIELD_NAMES = [
    "firstName",
    "lastName",
    "email",
    "password",
    "phoneNumber",
  ] as const;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { lastName, ...rest } = values;
      await signUp({ ...rest, lastName: lastName || undefined });
      navigate("/", { replace: true });
    } catch (error) {
      if (mapFieldErrors(error, setError, FIELD_NAMES)) return;
      if (!(error instanceof ApiError)) {
        setFormError({ message: "Something went wrong. Please try again." });
        return;
      }
      switch (error.status) {
        case 409:
          setFormError({ message: conflictMessage(error.message) });
          break;
        default:
          setFormError({
            message: "Something went wrong. Please try again.",
            requestId: error.requestId,
          });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <>
          <FormError
            message={formError.message}
            requestId={formError.requestId}
          />
          <LiveMessage>Registration failed: {formError.message}</LiveMessage>
        </>
      ) : null}
      <TextField
        label="First name"
        autoComplete="given-name"
        error={errors.firstName?.message}
        registration={register("firstName")}
      />
      <TextField
        label="Last name (optional)"
        autoComplete="family-name"
        error={errors.lastName?.message}
        registration={register("lastName")}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        registration={register("email")}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        passwordToggle
        error={errors.password?.message}
        registration={register("password")}
      />
      <TextField
        label="Phone number"
        type="tel"
        autoComplete="tel"
        error={errors.phoneNumber?.message}
        registration={register("phoneNumber")}
      />
      <button type="submit" disabled={isSubmitting} className="btn-primary">
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function RegisterPage() {
  return (
    <AuthShell
      title="Create an account"
      footer={<>Already have an account? {authLink("/login", "Sign in")}</>}
    >
      <RegisterForm />
    </AuthShell>
  );
}
