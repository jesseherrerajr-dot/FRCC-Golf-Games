"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ChecklistItem {
  label: string;
  complete: boolean;
  href: string;
  cta: string;
}

interface OnboardingChecklistProps {
  phone: string | null;
  ghin: string | null;
  hasPartnerPrefs: boolean;
}

const STORAGE_KEY = "frcc_checklist_dismissed";

export function OnboardingChecklist({
  phone,
  ghin,
  hasPartnerPrefs,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden until hydrated

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
    }
  }, []);

  const items: ChecklistItem[] = [
    {
      label: "Add your phone number",
      complete: !!phone,
      href: "/profile",
      cta: "Go to Profile",
    },
    {
      label: "Add your GHIN number",
      complete: !!ghin,
      href: "/profile",
      cta: "Go to Profile",
    },
    {
      label: "Set a playing partner preference",
      complete: hasPartnerPrefs,
      href: "/preferences",
      cta: "Go to Preferences",
    },
  ];

  const completedCount = items.filter((i) => i.complete).length;
  const allComplete = completedCount === items.length;

  // Don't show if all complete or dismissed
  if (allComplete || dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy-900">
          Complete Your Setup
        </h3>
        <span className="text-xs text-gray-400">
          {completedCount} of {items.length} done
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-teal-500 transition-all"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      {/* Checklist items */}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {item.complete ? (
                <svg
                  className="h-5 w-5 flex-shrink-0 text-teal-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-gray-300" />
              )}
              <span
                className={`text-sm ${
                  item.complete
                    ? "text-gray-400 line-through"
                    : "text-gray-700"
                }`}
              >
                {item.label}
              </span>
            </div>
            {!item.complete && (
              <Link
                href={item.href}
                className="text-xs font-medium text-teal-600 hover:text-teal-500"
              >
                {item.cta} &rarr;
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* Dismiss */}
      <div className="mt-3 border-t border-gray-100 pt-2">
        <button
          onClick={handleDismiss}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
