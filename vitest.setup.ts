import { webcrypto } from "node:crypto";

// JSDOM provides `atob`/`btoa` and storage APIs, but WebCrypto support can vary.
// Memoato crypto relies on `crypto.subtle`, so ensure it exists.
if (!globalThis.crypto || !("subtle" in globalThis.crypto)) {
  // @ts-expect-error - overriding for test env.
  globalThis.crypto = webcrypto;
}

