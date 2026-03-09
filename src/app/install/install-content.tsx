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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          </div>
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 006 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
          </div>
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
      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          What does this give me?
        </h2>
        <div className="mt-3 space-y-3 text-sm text-gray-600">
          <div className="flex gap-3">
            <span className="flex-shrink-0 text-teal-600">✓</span>
            <span>Opens <strong className="text-gray-900">full-screen</strong> with no browser toolbar — just like a real app</span>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 text-teal-600">✓</span>
            <span><strong className="text-gray-900">One tap</strong> from your home screen — no searching for bookmarks</span>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 text-teal-600">✓</span>
            <span><strong className="text-gray-900">Loads fast</strong> — it&apos;s the same site, just easier to access</span>
          </div>
        </div>
      </section>
    </>
  );
}
