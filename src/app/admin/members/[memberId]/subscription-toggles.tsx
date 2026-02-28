"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  adminSubscribeToEvent,
  adminUnsubscribeFromEvent,
} from "./actions";

export function SubscribeButton({
  profileId,
  eventId,
}: {
  profileId: string;
  eventId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await adminSubscribeToEvent(profileId, eventId);
          showToast("Subscribed to event");
        })
      }
      className="rounded-md bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
    >
      {isPending ? "Subscribing…" : "Subscribe"}
    </button>
  );
}

export function AdminUnsubscribeButton({
  profileId,
  eventId,
}: {
  profileId: string;
  eventId: string;
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
        {isPending ? "Removing…" : "Unsubscribe"}
      </button>
      <ConfirmModal
        open={showConfirm}
        title="Unsubscribe from Event"
        message="This golfer will stop receiving weekly invites for this event. They can re-subscribe anytime from their dashboard."
        confirmLabel="Unsubscribe"
        variant="danger"
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          startTransition(async () => {
            await adminUnsubscribeFromEvent(profileId, eventId);
            showToast("Unsubscribed from event");
          });
        }}
      />
    </>
  );
}
