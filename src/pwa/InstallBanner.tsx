import { useEffect, useMemo, useState } from "react";
import { useInstallPrompt } from "./useInstallPrompt";

const DISMISS_KEY = "memoato:pwaInstallBannerDismissed:v1";

function getDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

export function InstallBanner() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissedState] = useState<boolean>(() => getDismissed());

  const visible = useMemo(() => canInstall && !isInstalled && !dismissed, [canInstall, isInstalled, dismissed]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!visible) {
      document.documentElement.style.setProperty("--memoato-install-banner-h", "0px");
      return;
    }
    document.documentElement.style.setProperty(
      "--memoato-install-banner-h",
      "calc(72px + env(safe-area-inset-bottom))",
    );
    return () => {
      document.documentElement.style.setProperty("--memoato-install-banner-h", "0px");
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="mx-auto flex w-full max-w-screen-lg items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">Install memoato</div>
          <div className="truncate text-xs text-neutral-600 dark:text-neutral-400">
            Faster access from your home screen.
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            const outcome = await promptInstall();
            if (outcome === "dismissed") {
              setDismissed();
              setDismissedState(true);
            }
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissed();
            setDismissedState(true);
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-full px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Not now
        </button>
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
