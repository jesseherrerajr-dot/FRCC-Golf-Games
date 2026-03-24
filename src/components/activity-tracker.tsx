"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * ActivityTracker — logs page views to /api/activity on route changes.
 * Renders nothing. Include once in the root layout.
 * Fire-and-forget — errors are silently ignored.
 */
export function ActivityTracker() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip duplicate logs for the same path (e.g., re-renders)
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    // Skip non-app routes
    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/auth/")
    ) {
      return;
    }

    // Fire and forget — don't await
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Silently ignore — this is non-critical telemetry
    });
  }, [pathname]);

  return null;
}
