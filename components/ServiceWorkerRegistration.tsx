"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/notifications";

// Registers the PWA service worker (public/sw.js) app-wide, including the login screen -
// installability and the alert notifications it enables (see useAlertCenter.tsx) both
// depend on it being registered, not just the authenticated pages behind the sidebar.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
