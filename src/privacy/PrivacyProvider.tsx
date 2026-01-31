import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { clearSessionKey, loadSessionKey, saveSessionKey } from "./keyCache";
import {
  CryptoParams,
  deriveAesGcmKeyFromPassphrase,
  generateCryptoParams,
} from "./crypto";
import type { PrivacyMode } from "./types";

type PrivacyContextValue = {
  userId: string | null;
  mode: PrivacyMode;
  setMode: (mode: PrivacyMode) => void;
  cryptoParams: CryptoParams | null;
  setCryptoParams: (params: CryptoParams | null) => void;
  isUnlocked: boolean;
  key: CryptoKey | null;
  unlockWithPassphrase: (passphrase: string) => Promise<void>;
  lock: () => void;
  suggestedNewCryptoParams: () => CryptoParams;
  isLoading: boolean;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

const STORAGE_PREFIX = "memoato.privacy.v1";

function modeKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}:mode`;
}

function paramsKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}:cryptoParams`;
}

function loadStoredMode(userId: string): PrivacyMode {
  try {
    const raw = localStorage.getItem(modeKey(userId));
    if (raw === "encrypted" || raw === "local" || raw === "cloud") return raw;
    return "cloud";
  } catch {
    return "cloud";
  }
}

function loadStoredCryptoParams(userId: string): CryptoParams | null {
  try {
    const raw = localStorage.getItem(paramsKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as CryptoParams;
    if (!p || typeof p !== "object") return null;
    if (p.version !== 1) return null;
    if (typeof p.saltB64 !== "string") return null;
    if (typeof p.iterations !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

function saveStoredMode(userId: string, mode: PrivacyMode): void {
  localStorage.setItem(modeKey(userId), mode);
}

function saveStoredCryptoParams(userId: string, params: CryptoParams | null): void {
  if (!params) {
    localStorage.removeItem(paramsKey(userId));
    return;
  }
  localStorage.setItem(paramsKey(userId), JSON.stringify(params));
}

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const userId = auth.data?.id ?? null;
  const [mode, setModeState] = useState<PrivacyMode>("cloud");
  const [cryptoParams, setCryptoParamsState] = useState<CryptoParams | null>(null);

  const [key, setKey] = useState<CryptoKey | null>(null);
  const isUnlocked = !!key;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) return;
      if (mode !== "encrypted") return;
      const cached = await loadSessionKey(userId);
      if (cancelled) return;
      if (cached) setKey(cached);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, userId]);

  useEffect(() => {
    if (!userId) return;
    const storedMode = loadStoredMode(userId);
    const storedParams = loadStoredCryptoParams(userId);
    setModeState(storedMode);
    setCryptoParamsState(storedParams);
  }, [userId]);

  const setMode = useCallback(
    (m: PrivacyMode) => {
      if (!userId) return;
      saveStoredMode(userId, m);
      setModeState(m);
      if (m !== "encrypted") {
        clearSessionKey(userId);
        setKey(null);
      }
    },
    [userId],
  );

  const setCryptoParams = useCallback(
    (p: CryptoParams | null) => {
      if (!userId) return;
      saveStoredCryptoParams(userId, p);
      setCryptoParamsState(p);
      clearSessionKey(userId);
      setKey(null);
    },
    [userId],
  );

  const unlockWithPassphrase = useCallback(
    async (passphrase: string) => {
      if (!userId) return;
      if (mode !== "encrypted") return;
      const params = cryptoParams ?? generateCryptoParams();
      if (!cryptoParams) {
        saveStoredCryptoParams(userId, params);
        setCryptoParamsState(params);
      }
      const k = await deriveAesGcmKeyFromPassphrase(passphrase, params);
      setKey(k);
      await saveSessionKey(userId, k);
    },
    [cryptoParams, mode, userId],
  );

  const lock = useCallback(() => {
    if (!userId) return;
    clearSessionKey(userId);
    setKey(null);
  }, [userId]);

  const suggestedNewCryptoParams = useCallback((): CryptoParams => generateCryptoParams(), []);

  const value: PrivacyContextValue = useMemo(
    () => ({
      userId,
      mode,
      setMode,
      cryptoParams,
      setCryptoParams,
      isUnlocked,
      key,
      unlockWithPassphrase,
      lock,
      suggestedNewCryptoParams,
      isLoading: auth.isLoading,
    }),
    [
      auth.isLoading,
      cryptoParams,
      isUnlocked,
      key,
      lock,
      mode,
      setCryptoParams,
      setMode,
      suggestedNewCryptoParams,
      unlockWithPassphrase,
      userId,
    ],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy must be used within PrivacyProvider");
  return ctx;
}
