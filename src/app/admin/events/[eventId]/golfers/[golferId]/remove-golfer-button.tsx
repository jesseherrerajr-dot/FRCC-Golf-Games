"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import { eventRemoveGolferFromEvent } from "./actions";

export function EventRemoveGolferButton({
  profileId,
  eventId,
  eventName,
}: {
  profileId: string;
  eventId: string;
  eventName: string;
}) {
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
        {isPending ? "Removing…" : "Remove from this Event"}
      </button>
      <ConfirmModal
        open={showConfirm}
        title="Remove from Event"
        message={`This golfer will stop receiving weekly invites for ${eventName}. They can re-subscribe anytime from their dashboard.`}
        confirmLabel="Remove"
        variant="danger"
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          startTransition(async () => {
            await eventRemoveGolferFromEvent(profileId, eventId);
            showToast("Golfer removed from event");
          });
        }}
      />
    </>
  );
}
