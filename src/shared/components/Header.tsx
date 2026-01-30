import { logout, useAuth } from "wasp/client/auth";
import { Link } from "wasp/client/router";
import { getProfile, useQuery } from "wasp/client/operations";
import LogoFallback from "../../assets/logo.svg";
import { Button, ButtonLink } from "./Button";

export function Header() {
  const { data: user, isLoading } = useAuth();
  const profileQuery = useQuery(getProfile, undefined, { enabled: !!user, retry: false });
  const needsEmailVerification =
    !!user && profileQuery.isSuccess && profileQuery.data && !profileQuery.data.isEmailVerified;

  return (
    <header className="sticky top-0 z-20 flex justify-center border-b border-neutral-200 bg-white shadow-sm">
      <div className="flex w-full max-w-screen-lg items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-neutral-950">
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
                <li>
                  <Button onClick={logout}>Log out</Button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <ButtonLink to="/signup">Sign up</ButtonLink>
                </li>
                <li>
                  <ButtonLink to="/login" variant="ghost">
                    Login
                  </ButtonLink>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
