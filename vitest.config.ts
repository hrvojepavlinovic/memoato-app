import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "wasp/client/auth", replacement: "/src/test/waspClientAuth.ts" },
      { find: "wasp/server", replacement: "/src/test/waspServer.ts" },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
