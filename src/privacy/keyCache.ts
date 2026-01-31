import { exportKeyToB64, importKeyFromB64 } from "./crypto";

function storageKey(userId: string): string {
  return `memoato.cryptoKeyB64.v1:${userId}`;
}

export async function loadSessionKey(userId: string): Promise<CryptoKey | null> {
  try {
    const b64 = sessionStorage.getItem(storageKey(userId));
    if (!b64) return null;
    return await importKeyFromB64(b64);
  } catch {
    return null;
  }
}

export async function saveSessionKey(userId: string, key: CryptoKey): Promise<void> {
  const b64 = await exportKeyToB64(key);
  sessionStorage.setItem(storageKey(userId), b64);
}

export function clearSessionKey(userId: string): void {
  sessionStorage.removeItem(storageKey(userId));
}
