'use client';

import { Outlet } from "react-router-dom";
import "./App.css";
import { Header } from "./shared/components/Header";
import { useEffect } from "react";
import { Databuddy } from "./shared/components/Databuddy";
import { PrivacyProvider } from "./privacy/PrivacyProvider";

export function App() {
  useEffect(() => {
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
      <PrivacyProvider>
        <main className="flex min-h-screen w-full flex-col bg-neutral-50 text-neutral-900">
          <Header />
          <Databuddy />
          <Outlet />
        </main>
      </PrivacyProvider>
    </>
  );
}
