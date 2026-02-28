"use client";

import { ToastProvider } from "@/components/toast";
import { SwRegister } from "@/components/sw-register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SwRegister />
      {children}
    </ToastProvider>
  );
}
