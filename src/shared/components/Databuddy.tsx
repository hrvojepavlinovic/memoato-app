import { useEffect } from "react";

function getClientId(): string | null {
  const fromClientId = (import.meta as any).env?.REACT_APP_DATABUDDY_CLIENT_ID;
  const fromProjectId = (import.meta as any).env?.REACT_APP_DATABUDDY_PROJECT_ID;
  const raw = (fromClientId || fromProjectId || "").trim();
  return raw ? raw : null;
}

export function Databuddy() {
  useEffect(() => {
    const clientId = getClientId();
    if (!clientId) return;
    if (document.querySelector(`script[src="https://cdn.databuddy.cc/databuddy.js"]`)) return;

    const s = document.createElement("script");
    s.src = "https://cdn.databuddy.cc/databuddy.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.dataset.clientId = clientId;
    s.dataset.trackAttributes = "true";
    s.dataset.trackOutgoingLinks = "true";
    s.dataset.trackInteractions = "true";
    document.head.appendChild(s);
  }, []);

  return null;
}

