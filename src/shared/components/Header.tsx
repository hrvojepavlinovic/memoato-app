import { useAuth } from "wasp/client/auth";
import { Link } from "wasp/client/router";
import { getProfile, useQuery } from "wasp/client/operations";
import { useLocation } from "react-router-dom";
import LogoFallback from "../../assets/logo.svg";
import { useTheme } from "../../theme/ThemeProvider";
import { appNavigation, isNavigationActive } from "../navigation";
import { AppIcon } from "./AppIcon";

export function Header() {
  const { data: user, isLoading } = useAuth();
  const { pathname: path } = useLocation();
  const theme = useTheme();
  const profileQuery = useQuery(getProfile, undefined, {
    enabled: !!user,
    retry: false,
  });
  const needsEmailVerification =
    !!user && profileQuery.data?.needsEmailVerification;
  return (
    <header className="memoato-header">
      <a href="#main-content" className="memoato-skip">
        Skip to content
      </a>
      <div className="memoato-header-inner">
        <Link to="/" className="memoato-brand" aria-label="Memoato home">
          <img
            src="/logo.png"
            width="32"
            height="32"
            alt=""
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = LogoFallback;
            }}
          />
          <span>memoato</span>
        </Link>
        {!isLoading && user ? (
          <nav className="memoato-navigation" aria-label="Main navigation">
            {appNavigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={
                  isNavigationActive(path, item.paths) ? "page" : undefined
                }
              >
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="memoato-header-actions">
          <button
            type="button"
            className="memoato-icon-button"
            onClick={() => theme.setPreference(theme.isDark ? "light" : "dark")}
            aria-label={`Switch to ${theme.isDark ? "light" : "dark"} mode`}
          >
            <AppIcon name={theme.isDark ? "sun" : "moon"} />
          </button>
          {!isLoading && user ? (
            <Link
              to="/profile"
              className="memoato-icon-button memoato-profile-link"
              aria-current={path === "/profile" ? "page" : undefined}
              aria-label={
                needsEmailVerification
                  ? "Profile — email verification needed"
                  : "Profile"
              }
            >
              <AppIcon name="profile" />
              {needsEmailVerification ? (
                <span className="memoato-verification-dot" aria-hidden="true" />
              ) : null}
            </Link>
          ) : !isLoading ? (
            path.startsWith("/signup") ? (
              <Link to="/login" className="memoato-auth-link">
                Log in
              </Link>
            ) : path.startsWith("/login") ? (
              <Link to="/signup" className="memoato-auth-link">
                Sign up
              </Link>
            ) : (
              <Link to="/login" className="memoato-auth-link">
                Log in
              </Link>
            )
          ) : null}
        </div>
      </div>
    </header>
  );
}
