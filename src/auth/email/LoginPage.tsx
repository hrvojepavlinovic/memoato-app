import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "wasp/client/auth";
import { config } from "wasp/client";
import { AuthLayout } from "../AuthLayout";

const googleSignInUrl = `${config.apiUrl}/auth/google/login`;

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.25 3.6l6.9-6.9C36.13 2.37 30.5 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.02 6.22C12.43 13.02 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 5.99c4.51-4.18 7.09-10.34 7.09-17.64z" />
      <path fill="#FBBC05" d="M10.58 28.44a14.5 14.5 0 0 1 0-8.88l-8.02-6.22A23.94 23.94 0 0 0 0 24c0 3.86.92 7.53 2.56 10.66l8.02-6.22z" />
      <path fill="#34A853" d="M24 48c6.5 0 12.13-2.13 16.18-5.81l-7.73-5.99c-2.15 1.44-4.92 2.3-8.45 2.3-6.26 0-11.57-3.52-13.42-8.44l-8.02 6.22C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate("/", { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.data?.data?.message ?? err?.message ?? "Login failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="memoato-auth memoato-auth--login">
        <div className="mb-6">
          <h2>Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">Pick up where your memory left off.</p>
        </div>

        <a
          href={googleSignInUrl}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-[4px] border border-[#DADCE0] bg-white px-4 text-sm font-semibold text-neutral-900 hover:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-200"
        >
          <GoogleMark />
          Continue with Google
        </a>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">or</div>
          <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {errorMessage ? (
            <div className="rounded-[4px] border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={isLoading}
              required
              className="w-full px-3 py-2 text-neutral-950 dark:text-neutral-100"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
              required
              className="w-full px-3 py-2 text-neutral-950 dark:text-neutral-100"
            />
          </label>

          <button type="submit" disabled={isLoading} className="h-11 w-full rounded-[4px] px-4 text-sm font-bold">
            {isLoading ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-2 border-t border-neutral-200 pt-5 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        <span>
          New here?{" "}
          <Link to="/signup" className="font-bold text-neutral-950 underline decoration-neutral-300 underline-offset-4 dark:text-neutral-100">
            Create an account
          </Link>
        </span>
        <span>
          <Link to="/request-password-reset" className="font-bold text-neutral-950 underline decoration-neutral-300 underline-offset-4 dark:text-neutral-100">
            Forgot password?
          </Link>
        </span>
      </div>
    </AuthLayout>
  );
}
