import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "wasp/client/auth": "/src/test/waspClientAuth.ts",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
