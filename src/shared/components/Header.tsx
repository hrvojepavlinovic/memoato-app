import { useAuth } from "wasp/client/auth";
import { Link } from "wasp/client/router";
import { getProfile, useQuery } from "wasp/client/operations";
import { useLocation } from "react-router-dom";
import LogoFallback from "../../assets/logo.svg";
import { ButtonLink } from "./Button";

export function Header() {
  const { data: user, isLoading } = useAuth();
  const location = useLocation();
  const path = location.pathname || "/";
  const onLogin = path.startsWith("/login");
  const onSignup = path.startsWith("/signup");
  const profileQuery = useQuery(getProfile, undefined, {
    enabled: !!user,
    retry: false,
  });
  const needsEmailVerification =
    !!user &&
    profileQuery.isSuccess &&
    profileQuery.data &&
    profileQuery.data.needsEmailVerification;

  return (
    <header className="sticky top-0 z-50 flex justify-center border-b border-neutral-300 bg-[#f3f1ec]/95 backdrop-blur-md dark:border-neutral-800 dark:bg-[#11110f]/95">
      <div className="flex h-14 w-full max-w-screen-lg items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2.5"
          aria-label="Memoato home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-neutral-950 ring-1 ring-neutral-950 transition-transform group-active:translate-y-px dark:bg-neutral-100 dark:ring-neutral-100">
            <img
              src="/logo.png"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = LogoFallback;
              }}
              alt="Memoato"
              className="h-4 w-4 dark:invert"
            />
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="hidden text-[15px] font-extrabold tracking-[-0.03em] min-[430px]:block">
              memoato
            </h1>
            {user ? (
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 md:inline">
                Personal memory
              </span>
            ) : null}
          </div>
        </Link>
        <nav aria-hidden={isLoading}>
          <ul className="flex items-center gap-0.5 font-semibold sm:gap-1">
            {isLoading ? null : user ? (
              <>
                <li>
                  <ButtonLink
                    to="/"
                    size="sm"
                    variant="ghost"
                    className={
                      (path === "/"
                        ? "border-neutral-950 bg-white dark:border-neutral-200 dark:bg-neutral-900"
                        : "border-transparent") +
                      " px-2 text-xs sm:px-3 sm:text-sm"
                    }
                  >
                    Today
                  </ButtonLink>
                </li>
                <li>
                  <ButtonLink
                    to="/memory"
                    size="sm"
                    variant="ghost"
                    className={
                      (path.startsWith("/memory") ||
                      path.startsWith("/timeline")
                        ? "border-neutral-950 bg-white dark:border-neutral-200 dark:bg-neutral-900"
                        : "border-transparent") +
                      " px-2 text-xs sm:px-3 sm:text-sm"
                    }
                  >
                    Memory
                  </ButtonLink>
                </li>
                <li>
                  <ButtonLink
                    to="/recall"
                    size="sm"
                    variant="ghost"
                    className={
                      (path.startsWith("/recall")
                        ? "border-neutral-950 bg-white dark:border-neutral-200 dark:bg-neutral-900"
                        : "border-transparent") +
                      " px-2 text-xs sm:px-3 sm:text-sm"
                    }
                  >
                    Recall
                  </ButtonLink>
                </li>
                <li>
                  <ButtonLink
                    to="/views"
                    size="sm"
                    variant="ghost"
                    className={
                      (path.startsWith("/views") ||
                      path.startsWith("/c/") ||
                      path.startsWith("/categories/")
                        ? "border-neutral-950 bg-white dark:border-neutral-200 dark:bg-neutral-900"
                        : "border-transparent") +
                      " px-2 text-xs sm:px-3 sm:text-sm"
                    }
                  >
                    Views
                  </ButtonLink>
                </li>
                <li>
                  <span className="relative inline-flex">
                    <ButtonLink
                      to="/profile"
                      size="sm"
                      variant="ghost"
                      className={
                        (path.startsWith("/profile")
                          ? "border-neutral-950 bg-white dark:border-neutral-200 dark:bg-neutral-900"
                          : "border-transparent") + " h-9 w-9 px-0"
                      }
                      aria-label="Profile"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21a8 8 0 0 1 16 0" />
                      </svg>
                    </ButtonLink>
                    {needsEmailVerification ? (
                      <span
                        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500"
                        aria-label="Email not verified"
                        title="Email not verified"
                      />
                    ) : null}
                  </span>
                </li>
              </>
            ) : (
              <>
                {!onSignup ? (
                  <li>
                    <ButtonLink to="/signup" size="sm">
                      Start remembering
                    </ButtonLink>
                  </li>
                ) : null}
                {!onLogin ? (
                  <li>
                    <ButtonLink to="/login" size="sm" variant="ghost">
                      Login
                    </ButtonLink>
                  </li>
                ) : null}
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
