import type { CapacitorConfig } from "@capacitor/cli";

const isLiveReload = process.env.CAPACITOR_LIVE_RELOAD === "1";
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.memoato.app",
  appName: "memoato",
  webDir: "web",
  bundledWebRuntime: false,
  // Phase 1 (MVP): load the production web app so auth/API stay same-origin.
  server: isLiveReload
    ? {
        // Example values:
        // - Android emulator: http://10.0.2.2:3000
        // - iOS simulator: http://localhost:3000
        url: serverUrl || "http://10.0.2.2:3000",
        cleartext: true,
      }
    : {
        url: "https://app.memoato.com",
      },
};

export default config;

