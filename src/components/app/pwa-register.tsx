"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal — the app works fully without the service worker; it
        // only helps the shell survive a mid-session connectivity drop.
      });
    }
  }, []);

  return null;
}
