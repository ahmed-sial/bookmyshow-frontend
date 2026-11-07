import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/api/errors";
import { FormError } from "@/components/FormMessage";
import { TextField } from "@/components/TextField";
import { useSession } from "./session";
import { loginSchema, type LoginValues } from "./schemas";
import { mapFieldErrors } from "./mapFieldErrors";
import { AuthShell, authLink } from "./AuthShell";

/**
 * Login screen. Login failures are deliberately generic (AUTH-06): the user
 * is never told whether the email or the password was wrong.
 */
export function LoginForm() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [formError, setFormError] = useState<{
    message: string;
    requestId?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const FIELD_NAMES = ["email", "password"] as const;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      navigate("/", { replace: true });
    } catch (error) {
      if (mapFieldErrors(error, setError, FIELD_NAMES)) return;
      if (!(error instanceof ApiError)) {
        setFormError({ message: "Something went wrong. Please try again." });
        return;
      }
      switch (error.status) {
        case 401:
          setFormError({ message: "Invalid email or password." });
          break;
        case 429:
          setFormError({
            message: "Too many attempts. Please wait a moment and try again.",
          });
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
        <FormError
          message={formError.message}
          requestId={formError.requestId}
        />
      ) : null}
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
        autoComplete="current-password"
        passwordToggle
        error={errors.password?.message}
        registration={register("password")}
      />
      <button type="submit" disabled={isSubmitting} className="btn-primary">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      footer={<>New here? {authLink("/register", "Create an account")}</>}
    >
      <LoginForm />
    </AuthShell>
  );
}
