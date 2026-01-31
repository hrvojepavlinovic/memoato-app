import { decryptUtf8, tryDecodeEncryptedString } from "./crypto";

export async function decryptCategoryTitle(
  key: CryptoKey,
  title: string,
): Promise<string | null> {
  const payload = tryDecodeEncryptedString(title);
  if (!payload) return title.trim();
  try {
    return (await decryptUtf8(key, payload.b)).trim();
  } catch {
    return null;
  }
}

export async function decryptEventNote(
  key: CryptoKey,
  data: any,
): Promise<string | null> {
  const maybeEnc = data?.noteEnc as unknown;
  if (typeof maybeEnc === "string") {
    const payload = tryDecodeEncryptedString(maybeEnc);
    if (!payload) return null;
    try {
      return (await decryptUtf8(key, payload.b)).trim();
    } catch {
      return null;
    }
  }
  const note = typeof data?.note === "string" ? data.note : null;
  if (note) return note.trim();
  return null;
}
