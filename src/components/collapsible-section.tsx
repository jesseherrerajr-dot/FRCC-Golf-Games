"use client";

import { useState } from "react";
import Link from "next/link";

export function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
  headerColor = "text-gray-900",
  badge,
  viewAllHref,
  viewAllLabel = "View All",
  emptyMessage,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerColor?: string;
  badge?: { label: string; className: string };
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyMessage?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const showEmpty = count === 0 && emptyMessage;

  return (
    <section className="mt-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <h2 className={`text-lg font-semibold ${headerColor}`}>
            {title}
            {count !== undefined && (
              <span className="ml-1 text-base font-normal text-gray-400">
                ({count})
              </span>
            )}
          </h2>
          {badge && (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewAllHref && isOpen && (
            <Link
              href={viewAllHref}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-teal-700 hover:text-teal-600"
            >
              {viewAllLabel} &rarr;
            </Link>
          )}
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="mt-2">
          {showEmpty ? (
            <p className="text-sm text-gray-500">{emptyMessage}</p>
          ) : (
            children
          )}
        </div>
      )}

      {!isOpen && showEmpty && (
        <p className="mt-1 pl-1 text-sm text-gray-400">{emptyMessage}</p>
      )}
    </section>
  );
}
