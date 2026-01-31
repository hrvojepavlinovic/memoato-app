import { describe, expect, it } from "vitest";
import { decryptCategoryTitle, decryptEventNote } from "./decryptors";
import { encryptUtf8ToEncryptedString, generateCryptoParams } from "./crypto";

describe("decryptors", () => {
  it("returns trimmed title when not encrypted", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    expect(await decryptCategoryTitle(key, "  Push ups  ")).toBe("Push ups");
  });

  it("decrypts encrypted title", async () => {
    const params = generateCryptoParams();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const enc = await encryptUtf8ToEncryptedString(key, params, "Weight");
    expect(await decryptCategoryTitle(key, enc)).toBe("Weight");
  });

  it("decrypts encrypted note and falls back to plaintext note", async () => {
    const params = generateCryptoParams();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const enc = await encryptUtf8ToEncryptedString(key, params, "hello");
    expect(await decryptEventNote(key, { noteEnc: enc })).toBe("hello");
    expect(await decryptEventNote(key, { note: "  hi  " })).toBe("hi");
  });
});

