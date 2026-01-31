import { describe, expect, it } from "vitest";
import {
  decryptUtf8,
  encryptUtf8ToEncryptedString,
  generateCryptoParams,
  isEncryptedString,
  tryDecodeEncryptedString,
} from "./crypto";

describe("privacy crypto", () => {
  it("round-trips encrypted strings", async () => {
    const params = generateCryptoParams();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const plaintext = "hello world";

    const enc = await encryptUtf8ToEncryptedString(key, params, plaintext);
    expect(isEncryptedString(enc)).toBe(true);

    const payload = tryDecodeEncryptedString(enc);
    expect(payload?.p.version).toBe(1);
    expect(payload?.p.saltB64).toBe(params.saltB64);
    expect(payload?.p.iterations).toBe(params.iterations);

    const dec = await decryptUtf8(key, payload!.b);
    expect(dec).toBe(plaintext);
  });

  it("does not treat plain strings as encrypted", () => {
    expect(isEncryptedString("hello")).toBe(false);
    expect(tryDecodeEncryptedString("hello")).toBeNull();
  });

  it("rejects invalid payloads", () => {
    expect(tryDecodeEncryptedString("enc:v1:notbase64")).toBeNull();
  });
});

