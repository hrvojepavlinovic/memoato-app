const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type CryptoParams = {
  version: number;
  saltB64: string;
  iterations: number;
};

export type EncryptedBlobV1 = {
  v: 1;
  alg: "AES-GCM";
  ivB64: string;
  ctB64: string;
};

export type EncryptedStringPayloadV1 = {
  p: CryptoParams;
  b: EncryptedBlobV1;
};

const ENCRYPTED_STRING_PREFIX = "enc:v1:";

export function isEncryptedString(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENCRYPTED_STRING_PREFIX);
}

export function encodeEncryptedString(payload: EncryptedStringPayloadV1): string {
  const json = JSON.stringify(payload);
  const b64 = bytesToBase64(textEncoder.encode(json));
  return `${ENCRYPTED_STRING_PREFIX}${b64}`;
}

export function tryDecodeEncryptedString(value: unknown): EncryptedStringPayloadV1 | null {
  if (!isEncryptedString(value)) return null;
  const b64 = value.slice(ENCRYPTED_STRING_PREFIX.length);
  try {
    const bytes = base64ToBytes(b64);
    const json = textDecoder.decode(bytes);
    const parsed = JSON.parse(json) as EncryptedStringPayloadV1;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.p || typeof parsed.p !== "object") return null;
    if (!parsed.b || typeof parsed.b !== "object") return null;
    if (parsed.p.version !== 1) return null;
    if (typeof parsed.p.saltB64 !== "string") return null;
    if (typeof parsed.p.iterations !== "number") return null;
    if (parsed.b.v !== 1) return null;
    if (parsed.b.alg !== "AES-GCM") return null;
    if (typeof parsed.b.ivB64 !== "string") return null;
    if (typeof parsed.b.ctB64 !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function generateCryptoParams(): CryptoParams {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { version: 1, saltB64: bytesToBase64(salt), iterations: 310_000 };
}

export async function deriveAesGcmKeyFromPassphrase(
  passphrase: string,
  params: CryptoParams,
): Promise<CryptoKey> {
  const clean = passphrase.normalize("NFKC");
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(clean),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  const salt = base64ToBytes(params.saltB64);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: params.iterations,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportKeyToB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToBase64(new Uint8Array(raw));
}

export async function importKeyFromB64(b64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(b64);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptUtf8(
  key: CryptoKey,
  plaintext: string,
): Promise<EncryptedBlobV1> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plaintext));
  return { v: 1, alg: "AES-GCM", ivB64: bytesToBase64(iv), ctB64: bytesToBase64(new Uint8Array(ct)) };
}

export async function decryptUtf8(key: CryptoKey, blob: EncryptedBlobV1): Promise<string> {
  if (!blob || blob.v !== 1 || blob.alg !== "AES-GCM") {
    throw new Error("Unsupported encrypted payload");
  }
  const iv = base64ToBytes(blob.ivB64);
  const ct = base64ToBytes(blob.ctB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return textDecoder.decode(pt);
}

export async function encryptJson(
  key: CryptoKey,
  obj: unknown,
): Promise<EncryptedBlobV1> {
  return encryptUtf8(key, JSON.stringify(obj));
}

export async function decryptJson<T>(
  key: CryptoKey,
  blob: EncryptedBlobV1,
): Promise<T> {
  const s = await decryptUtf8(key, blob);
  return JSON.parse(s) as T;
}

export async function encryptUtf8ToEncryptedString(
  key: CryptoKey,
  params: CryptoParams,
  plaintext: string,
): Promise<string> {
  const b = await encryptUtf8(key, plaintext);
  return encodeEncryptedString({ p: params, b });
}
