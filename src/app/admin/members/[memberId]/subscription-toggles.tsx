"use client";

import { useTransition } from "react";
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

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => { await adminSubscribeToEvent(profileId, eventId); })
      }
      className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
    >
      {isPending ? "..." : "Subscribe"}
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

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (
          confirm(
            "Unsubscribe this golfer from the event? They will stop receiving weekly invites."
          )
        ) {
          startTransition(async () => { await adminUnsubscribeFromEvent(profileId, eventId); });
        }
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "..." : "Unsubscribe"}
    </button>
  );
}
