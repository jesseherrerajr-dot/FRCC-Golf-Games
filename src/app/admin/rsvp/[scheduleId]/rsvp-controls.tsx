"use client";

import { useTransition } from "react";
import {
  adminUpdateRsvpStatus,
  adminPromoteFromWaitlist,
} from "./actions";

type RsvpStatus = "in" | "out" | "not_sure" | "no_response" | "waitlisted";

const statusOptions: { value: RsvpStatus; label: string }[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
  { value: "not_sure", label: "Not Sure" },
  { value: "no_response", label: "No Response" },
  { value: "waitlisted", label: "Waitlisted" },
];

export function StatusDropdown({
  rsvpId,
  scheduleId,
  currentStatus,
}: {
  rsvpId: string;
  scheduleId: string;
  currentStatus: RsvpStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as RsvpStatus;
    if (newStatus === currentStatus) return;

    startTransition(async () => {
      const result = await adminUpdateRsvpStatus(rsvpId, newStatus, scheduleId);
      if (result.error) {
        alert(result.error);
      }
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
    >
      {statusOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function PromoteButton({
  rsvpId,
  scheduleId,
  golferName,
}: {
  rsvpId: string;
  scheduleId: string;
  golferName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Move ${golferName} from waitlist to confirmed?`)) return;

    startTransition(async () => {
      const result = await adminPromoteFromWaitlist(rsvpId, scheduleId);
      if (result.error) {
        alert(result.error);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
    >
      {isPending ? "..." : "Move to In"}
    </button>
  );
}

export function QuickActionButton({
  rsvpId,
  scheduleId,
  action,
  label,
  confirmMessage,
  className,
}: {
  rsvpId: string;
  scheduleId: string;
  action: RsvpStatus;
  label: string;
  confirmMessage?: string;
  className: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (confirmMessage && !confirm(confirmMessage)) return;

    startTransition(async () => {
      const result = await adminUpdateRsvpStatus(rsvpId, action, scheduleId);
      if (result.error) {
        alert(result.error);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${className}`}
    >
      {isPending ? "..." : label}
    </button>
  );
}
