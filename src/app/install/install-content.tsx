"use client";

import { useState, useEffect } from "react";

type Platform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function InstallContent() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }, []);

  return (
    <>
      {/* Already installed */}
      {isStandalone && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            You&apos;re already using the app from your home screen!
          </p>
        </div>
      )}

      {/* iOS Instructions */}
      <section
        className={`rounded-lg border bg-white p-6 shadow-sm ${
          platform === "ios"
            ? "border-teal-200 ring-2 ring-teal-100"
            : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            iPhone & iPad (Safari)
          </h2>
          {platform === "ios" && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
              Your device
            </span>
          )}
        </div>
        <ol className="mt-4 space-y-4 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
              1
            </span>
            <span>
              Open{" "}
              <strong className="text-gray-900">
                frccgolfgames.vercel.app
              </strong>{" "}
              in <strong className="text-gray-900">Safari</strong> (this
              won&apos;t work in Chrome or other browsers on iOS).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
              2
            </span>
            <span>
              Tap the{" "}
              <strong className="text-gray-900">Share button</strong>{" "}
              <span
                className="inline-block text-base leading-none"
                aria-label="share icon"
              >
                ⬆
              </span>{" "}
              at the bottom of the screen.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
              3
            </span>
            <span>
              Scroll down and tap{" "}
              <strong className="text-gray-900">
                &quot;Add to Home Screen&quot;
              </strong>
              .
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
              4
            </span>
            <span>
              Tap <strong className="text-gray-900">Add</strong>. The FRCC
              Golf Games icon will appear on your home screen.
            </span>
          </li>
        </ol>
      </section>

      {/* Android Instructions */}
      <section
        className={`mt-4 rounded-lg border bg-white p-6 shadow-sm ${
          platform === "android"
            ? "border-teal-200 ring-2 ring-teal-100"
            : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Android (Chrome)
          </h2>
          {platform === "android" && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
              Your device
            </span>
          )}
        </div>
        <ol className="mt-4 space-y-4 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
              1
            </span>
            <span>
              Open{" "}
              <strong className="text-gray-900">
                frccgolfgames.vercel.app
              </strong>{" "}
              in <strong className="text-gray-900">Chrome</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
              2
            </span>
            <span>
              Tap the{" "}
              <strong className="text-gray-900">three-dot menu</strong>{" "}
              <span
                className="inline-block text-base leading-none"
                aria-label="menu icon"
              >
                ⋮
              </span>{" "}
              in the top-right corner.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
              3
            </span>
            <span>
              Tap{" "}
              <strong className="text-gray-900">
                &quot;Add to Home screen&quot;
              </strong>{" "}
              or{" "}
              <strong className="text-gray-900">
                &quot;Install app&quot;
              </strong>
              .
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
              4
            </span>
            <span>
              Tap <strong className="text-gray-900">Install</strong>. The
              app icon will appear on your home screen.
            </span>
          </li>
        </ol>
      </section>

      {/* What you get */}
      <section className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h2 className="font-semibold text-gray-900">
          What does this give me?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Once installed, FRCC Golf Games works like a native app on your
          phone — it opens full-screen with no browser toolbar, loads
          quickly, and is always one tap away from your home screen. It&apos;s
          the same site, just easier to access.
        </p>
      </section>
    </>
  );
}
