import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "wasp/client/api";
import { AuthLayout } from "../AuthLayout";

export function EmailVerificationPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        const res = await api.post("/auth/email/verify-email", { token });
        const sessionId = res?.data?.sessionId;
        if (cancelled) return;

        if (typeof sessionId === "string" && sessionId.length > 5) {
          localStorage.setItem("wasp:sessionId", JSON.stringify(sessionId));
          window.location.replace("/");
          return;
        }

        // Fallback: verification succeeded, but no session returned.
        window.location.replace("/login");
      } catch (e: any) {
        if (cancelled) return;
        setErrorMessage(e?.response?.data?.message ?? e?.message ?? "Email verification failed.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Email verification</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">memoato</p>
      </div>

      {!token ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          Missing verification token.
        </div>
      ) : status === "loading" ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          Verifying… You’ll be logged in automatically.
        </div>
      ) : status === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">
          {errorMessage ?? "Email verification failed."}
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          Verifying…
        </div>
      )}

      <div className="mt-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">
        <Link to="/login" className="font-semibold underline">
          Go to login
        </Link>
        .
      </div>
    </AuthLayout>
  );
}
