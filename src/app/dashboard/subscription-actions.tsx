"use client";

import { useTransition } from "react";
import { unsubscribeFromEvent } from "./actions";

export function UnsubscribeButton({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (confirm("Unsubscribe from this event? You will stop receiving weekly invites.")) {
          startTransition(async () => { await unsubscribeFromEvent(eventId); });
        }
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "..." : "Unsubscribe"}
    </button>
  );
}
