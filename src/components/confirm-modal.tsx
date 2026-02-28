"use client";

import { useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when the modal opens
  useEffect(() => {
    if (open) {
      // Small delay to let the modal render
      const timer = setTimeout(() => confirmRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmStyles =
    variant === "danger"
      ? "border border-red-300 bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/30"
      : "bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500/30";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal card — appears from bottom on mobile, centered on desktop */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="
          relative z-10 w-full max-w-sm rounded-t-xl bg-white p-6 shadow-xl
          sm:rounded-xl sm:mx-4
          animate-in slide-in-from-bottom duration-200
        "
      >
        <h3
          id="confirm-title"
          className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900"
        >
          {title}
        </h3>
        <p id="confirm-message" className="mt-2 text-sm text-gray-600 leading-relaxed">
          {message}
        </p>

        {/* Action buttons — stacked on mobile for thumb-friendly tapping */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="
              w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm
              font-medium text-gray-700 transition-colors
              hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300/50
              disabled:opacity-50 sm:w-auto sm:py-2.5
            "
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`
              w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors
              focus:outline-none focus:ring-2
              disabled:opacity-50 sm:w-auto sm:py-2.5
              ${confirmStyles}
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {confirmLabel.replace(/^(\w+)/, "$1ing").replace(/eing$/, "ing")}…
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
