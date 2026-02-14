"use client";

import { useState } from "react";
import { approveGuestRequest, denyGuestRequest } from "./guest-actions";

export function GuestApprovalButton({
  guestRequestId,
  scheduleId,
  guestName,
}: {
  guestRequestId: string;
  scheduleId: string;
  guestName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    if (
      !confirm(
        `Approve guest request for ${guestName}? This will confirm them for the game.`
      )
    ) {
      return;
    }

    setLoading(true);
    const result = await approveGuestRequest(guestRequestId, scheduleId);

    if (result.error) {
      alert(result.error);
    }

    setLoading(false);
  }

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:bg-gray-400"
    >
      {loading ? "..." : "Approve"}
    </button>
  );
}

export function GuestDenialButton({
  guestRequestId,
  scheduleId,
  guestName,
}: {
  guestRequestId: string;
  scheduleId: string;
  guestName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDeny() {
    if (!confirm(`Deny guest request for ${guestName}?`)) {
      return;
    }

    setLoading(true);
    const result = await denyGuestRequest(guestRequestId, scheduleId);

    if (result.error) {
      alert(result.error);
    }

    setLoading(false);
  }

  return (
    <button
      onClick={handleDeny}
      disabled={loading}
      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:bg-gray-100 disabled:text-gray-400"
    >
      {loading ? "..." : "Deny"}
    </button>
  );
}
