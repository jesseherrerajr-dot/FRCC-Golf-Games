"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
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
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
      >
        {isPending ? "Approving…" : "Approve"}
      </button>
      <ConfirmModal
        open={showConfirm}
        title="Approve Guest"
        message={`Approve ${guestName} for this week's game? A confirmation email will be sent.`}
        confirmLabel="Approve"
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          startTransition(async () => {
            const result = await approveGuestRequest(guestRequestId, scheduleId);
            if (result.error) {
              showToast(result.error, "error");
            } else {
              showToast(`${guestName} approved`);
            }
          });
        }}
      />
    </>
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
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Denying…" : "Deny"}
      </button>
      <ConfirmModal
        open={showConfirm}
        title="Deny Guest"
        message={`Deny the guest request for ${guestName}?`}
        confirmLabel="Deny"
        variant="danger"
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          startTransition(async () => {
            const result = await denyGuestRequest(guestRequestId, scheduleId);
            if (result.error) {
              showToast(result.error, "error");
            } else {
              showToast(`${guestName} denied`);
            }
          });
        }}
      />
    </>
  );
}
