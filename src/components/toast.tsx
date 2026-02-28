"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

const TOAST_DURATION = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — fixed bottom-center, above thumb zone */}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Individual Toast ────────────────────────────────────────────────────────

const typeStyles: Record<ToastType, string> = {
  success: "border-teal-200 bg-teal-50 text-teal-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-navy-200 bg-navy-50 text-navy-800",
};

const typeIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    const enterTimer = requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after duration
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      // Wait for exit animation before removing
      setTimeout(() => onDismiss(toast.id), 200);
    }, TOAST_DURATION);

    return () => {
      cancelAnimationFrame(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      className={`
        flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg
        transition-all duration-200 ease-out
        ${typeStyles[toast.type]}
        ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}
      `}
      style={{ minWidth: "200px", maxWidth: "360px" }}
    >
      <span className="flex-shrink-0 text-base leading-none">{typeIcons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(toast.id), 200);
        }}
        className="flex-shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
