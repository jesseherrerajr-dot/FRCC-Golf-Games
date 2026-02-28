"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
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
  const { showToast } = useToast();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as RsvpStatus;
    if (newStatus === currentStatus) return;

    startTransition(async () => {
      const result = await adminUpdateRsvpStatus(rsvpId, newStatus, scheduleId);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Status updated");
      }
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-md border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
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
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="rounded-md bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
      >
        {isPending ? "Moving…" : "Move to In"}
      </button>
      <ConfirmModal
        open={showConfirm}
        title="Promote from Waitlist"
        message={`Move ${golferName} from the waitlist to confirmed? They will count toward the week's capacity.`}
        confirmLabel="Confirm"
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          startTransition(async () => {
            const result = await adminPromoteFromWaitlist(rsvpId, scheduleId);
            if (result.error) {
              showToast(result.error, "error");
            } else {
              showToast(`${golferName} moved to confirmed`);
            }
          });
        }}
      />
    </>
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
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();

  function handleClick() {
    if (confirmMessage) {
      setShowConfirm(true);
    } else {
      doAction();
    }
  }

  function doAction() {
    startTransition(async () => {
      const result = await adminUpdateRsvpStatus(rsvpId, action, scheduleId);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Status updated");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50 ${className}`}
      >
        {isPending ? "Updating…" : label}
      </button>
      {confirmMessage && (
        <ConfirmModal
          open={showConfirm}
          title="Confirm Action"
          message={confirmMessage}
          confirmLabel={label}
          loading={isPending}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            setShowConfirm(false);
            doAction();
          }}
        />
      )}
    </>
  );
}
