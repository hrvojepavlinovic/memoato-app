import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "wasp/client/auth";
import { AuthLayout } from "../AuthLayout";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password;
    if (!cleanEmail) return setErrorMessage("Email is required.");
    if (!cleanPassword) return setErrorMessage("Password is required.");

    setIsLoading(true);
    try {
      await login({ email: cleanEmail, password: cleanPassword });
      navigate("/", { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.data?.data?.message ?? err?.message ?? "Login failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Log in</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">memoato</p>
      </div>

      <a
        href="/auth/google"
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
      >
        Continue with Google
      </a>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">OR</div>
        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="label">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            autoComplete="email"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="h-10 w-full rounded-lg bg-neutral-950 px-4 font-semibold text-white hover:bg-neutral-900 disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
        >
          {isLoading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <br />
      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {"Don't have an account yet? "}
        <Link to="/signup" className="font-semibold underline">
          Go to signup
        </Link>
        .
      </span>
      <br />
      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {"Forgot your password? "}
        <Link to="/request-password-reset" className="font-semibold underline">
          Reset it
        </Link>
        .
      </span>
    </AuthLayout>
  );
}
