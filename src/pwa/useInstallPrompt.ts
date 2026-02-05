import { useCallback, useEffect, useMemo, useState } from "react";

type UserChoiceOutcome = "accepted" | "dismissed";

// Not in TS libdom yet.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: UserChoiceOutcome; platform: string }>;
};

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  // iOS Safari legacy
  return (navigator as any)?.standalone === true;
}

export function useInstallPrompt(): {
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<UserChoiceOutcome | null>;
} {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneDisplayMode());

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      // Needed so we can show our own UI. Without this, Chrome may show its mini-infobar.
      e.preventDefault?.();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const canInstall = useMemo(() => !!deferredPrompt && !isInstalled, [deferredPrompt, isInstalled]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice.outcome ?? null;
    } catch (_error) {
      setDeferredPrompt(null);
      return null;
    }
  }, [deferredPrompt]);

  return { canInstall, isInstalled, promptInstall };
}

