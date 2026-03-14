"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import { unsubscribeFromEvent } from "./actions";

export function UnsubscribeButton({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();

  return (
    <>
      <button
        disabled={isPending}
        onClick={() => setShowConfirm(true)}
        className="rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Removing…" : "Unsubscribe"}
      </button>
      <ConfirmModal
        open={showConfirm}
        title="Unsubscribe from Event"
        message="You'll stop receiving weekly invites for this event. You can re-subscribe anytime by contacting an admin or using a join link."
        confirmLabel="Unsubscribe"
        variant="danger"
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          startTransition(async () => {
            await unsubscribeFromEvent(eventId);
            showToast("Unsubscribed from event");
          });
        }}
      />
    </>
  );
}
