"use client";

import { useState, useEffect, useCallback } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array for the
 * PushManager.subscribe() call.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState = "loading" | "unsupported" | "off" | "on";

export function PushToggle() {
  const [state, setState] = useState<PushState>("loading");

  // Check current subscription status on mount
  useEffect(() => {
    async function check() {
      // Hide entirely if browser doesn't support push
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !VAPID_PUBLIC_KEY
      ) {
        setState("unsupported");
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    }

    check();
  }, []);

  const toggle = useCallback(async () => {
    if (state !== "on" && state !== "off") return;

    setState("loading");

    try {
      const reg = await navigator.serviceWorker.ready;

      if (state === "off") {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState("off");
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const subJson = sub.toJSON();

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            userAgent: navigator.userAgent,
          }),
        });

        setState("on");
      } else {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/unsubscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setState("off");
      }
    } catch (err) {
      console.error("Push toggle error:", err);
      // Try to recover the actual state
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    }
  }, [state]);

  // Don't render anything on unsupported browsers (iOS, etc.)
  if (state === "unsupported") return null;

  return (
    <button
      onClick={toggle}
      disabled={state === "loading"}
      className="rounded-md p-2.5 text-navy-700 transition-colors hover:bg-navy-50 hover:text-navy-900 disabled:opacity-50"
      title={
        state === "on"
          ? "Push notifications on — tap to turn off"
          : "Turn on push notifications"
      }
      aria-label={
        state === "on" ? "Disable push notifications" : "Enable push notifications"
      }
    >
      {state === "loading" ? (
        /* Spinner */
        <svg
          className="h-5 w-5 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : state === "on" ? (
        /* Filled bell — notifications active */
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2a7 7 0 00-7 7c0 3.53-1.13 5.46-2.18 6.63A1 1 0 003.5 17.5h17a1 1 0 00.68-1.87C20.13 14.46 19 12.53 19 9a7 7 0 00-7-7z" />
          <path d="M10.27 20a2 2 0 003.46 0H10.27z" />
        </svg>
      ) : (
        /* Outline bell — notifications off */
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      )}
    </button>
  );
}
