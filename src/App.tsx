"use client";

import { useAuth } from "wasp/client/auth";
import { Outlet } from "react-router-dom";
import "./App.css";
import { Header } from "./shared/components/Header";
import { useEffect } from "react";
import { PrivacyProvider } from "./privacy/PrivacyProvider";
import { ThemeProvider } from "./theme/ThemeProvider";
import { InstallBanner } from "./pwa/InstallBanner";

export function App() {
  const { data: user } = useAuth();
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/service-worker.js");
      } catch (error) {
        console.error("Failed to register service worker", error);
      }
    };
    register();
  }, []);

  return (
    <>
      <ThemeProvider>
        <PrivacyProvider>
          <div
            className={
              user
                ? "memoato-app-shell memoato-app-shell--signed-in"
                : "memoato-app-shell"
            }
          >
            <Header />
            <main
              id="main-content"
              tabIndex={-1}
              className="memoato-page-content"
            >
              <Outlet />
            </main>
          </div>
          <InstallBanner />
        </PrivacyProvider>
      </ThemeProvider>
    </>
  );
}
