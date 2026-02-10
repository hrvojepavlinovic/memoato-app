import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, signup } from "wasp/client/auth";
import { AuthLayout } from "../AuthLayout";

function getEmailLocalPart(email: string): string {
  const at = email.indexOf("@");
  const local = at >= 0 ? email.slice(0, at) : email;
  return local.trim();
}

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const lastSuggestedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!email) return;
    if (usernameTouched) return;
    const suggested = getEmailLocalPart(email).replace(/\s+/g, "");
    if (!suggested) return;
    if (lastSuggestedRef.current === suggested) return;
    lastSuggestedRef.current = suggested;
    setUsername(suggested);
  }, [email, usernameTouched]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanUsername = username.trim();

    if (!cleanEmail) return setErrorMessage("Email is required.");
    if (!cleanPassword) return setErrorMessage("Password is required.");
    if (!cleanUsername) return setErrorMessage("Username is required.");
    if (/\s/.test(cleanUsername)) return setErrorMessage("Username cannot contain whitespace.");

    setIsLoading(true);
    try {
      await signup({ email: cleanEmail, password: cleanPassword, username: cleanUsername });
      try {
        await login({ email: cleanEmail, password: cleanPassword });
        navigate("/", { replace: true });
        return;
      } catch {
        setIsSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(err?.data?.data?.message ?? err?.message ?? "Sign up failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function GoogleMark() {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px]">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.73 1.22 9.25 3.6l6.9-6.9C36.13 2.37 30.5 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.02 6.22C12.43 13.02 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 5.99c4.51-4.18 7.09-10.34 7.09-17.64z"
        />
        <path
          fill="#FBBC05"
          d="M10.58 28.44a14.5 14.5 0 0 1 0-8.88l-8.02-6.22A23.94 23.94 0 0 0 0 24c0 3.86.92 7.53 2.56 10.66l8.02-6.22z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.5 0 12.13-2.13 16.18-5.81l-7.73-5.99c-2.15 1.44-4.92 2.3-8.45 2.3-6.26 0-11.57-3.52-13.42-8.44l-8.02 6.22C6.51 42.62 14.62 48 24 48z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Create a new account</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">memoato</p>
      </div>

      {isSuccess ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          <div className="font-semibold">Almost there.</div>
          <div className="mt-1">
            We sent you a confirmation link. You can start using memoato now, but please verify your email soon.
          </div>
        </div>
      ) : (
        <>
          <a
            href="/auth/google/login"
            className="flex h-10 w-full items-center justify-center gap-3 rounded-lg border border-[#DADCE0] bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-[#F8F9FA] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            <GoogleMark />
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
              autoComplete="new-password"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsernameTouched(true);
                setUsername(e.target.value);
              }}
              disabled={isLoading}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
              autoComplete="username"
              required
            />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">No spaces.</span>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-lg bg-neutral-950 px-4 font-semibold text-white hover:bg-neutral-900 disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            {isLoading ? "Signing up…" : "Sign up"}
          </button>
          </form>
        </>
      )}
      <br />
      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {"Already have an account? "}
        <Link to="/login" className="font-semibold underline">
          Go to login
        </Link>
        .
      </span>
    </AuthLayout>
  );
}
