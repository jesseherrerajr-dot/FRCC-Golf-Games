"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount. Added to Providers so it
 * runs once on app load. No-op on browsers without SW support.
 */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed:", err);
      });
    }
  }, []);

  return null;
}
