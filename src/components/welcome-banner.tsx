"use client";

import { useState, useEffect } from "react";

interface WelcomeBannerProps {
  storageKey: string;
  title: string;
  items: string[];
}

export function WelcomeBanner({ storageKey, title, items }: WelcomeBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem(storageKey);
      if (!dismissed) {
        setVisible(true);
      }
    }
  }, [storageKey]);

  function handleDismiss() {
    localStorage.setItem(storageKey, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-teal-900">{title}</h3>
        <button
          onClick={handleDismiss}
          className="ml-4 flex-shrink-0 rounded-md p-1 text-teal-400 hover:bg-teal-100 hover:text-teal-600"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-teal-800">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 block h-1 w-1 flex-shrink-0 rounded-full bg-teal-400" />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
      <button
        onClick={handleDismiss}
        className="mt-3 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
      >
        Got it
      </button>
    </div>
  );
}
