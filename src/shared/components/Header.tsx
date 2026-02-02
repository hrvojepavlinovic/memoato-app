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
  const profileQuery = useQuery(getProfile, undefined, { enabled: !!user, retry: false });
  const needsEmailVerification =
    !!user && profileQuery.isSuccess && profileQuery.data && !profileQuery.data.isEmailVerified;

  return (
    <header className="sticky top-0 z-20 flex justify-center border-b border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex w-full max-w-screen-lg items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-neutral-200 bg-neutral-950 dark:border-neutral-700">
            <img
              src="/logo.png"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = LogoFallback;
              }}
              alt="Memoato"
              className="h-[18px] w-[18px]"
            />
          </div>
          <h1 className="text-lg font-bold tracking-tight">memoato</h1>
        </Link>
        <nav aria-hidden={isLoading}>
          <ul className="flex gap-4 font-semibold">
            {isLoading ? null : user ? (
              <>
                <li>
                  <ButtonLink to="/timeline" variant="ghost">
                    Timeline
                  </ButtonLink>
                </li>
                <li>
                  <span className="relative inline-flex">
                    <ButtonLink to="/profile" variant="ghost">
                      Profile
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
                    <ButtonLink to="/signup">Sign up</ButtonLink>
                  </li>
                ) : null}
                {!onLogin ? (
                  <li>
                    <ButtonLink to="/login" variant="ghost">
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
