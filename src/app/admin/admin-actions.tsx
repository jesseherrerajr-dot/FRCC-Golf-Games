"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  approveRegistration,
  denyRegistration,
  deactivateGolfer,
  reactivateGolfer,
} from "./actions";

export function ApproveButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await approveRegistration(profileId);
          showToast("Golfer approved");
        })
      }
      className="rounded-md bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
    >
      {isPending ? "Approving…" : "Approve"}
    </button>
  );
}

export function DenyButton({ profileId }: { profileId: string }) {
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
        {isPending ? "Denying…" : "Deny"}
      </button>
      <ConfirmModal
        open={showConfirm}
        title="Deny Registration"
        message="This golfer's registration will be denied and their account deactivated. They will not receive any invites."
        confirmLabel="Deny"
        variant="danger"
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          startTransition(async () => {
            await denyRegistration(profileId);
            showToast("Registration denied");
          });
        }}
      />
    </>
  );
}

export function DeactivateButton({ profileId }: { profileId: string }) {
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
        {isPending ? "Deactivating…" : "Deactivate"}
      </button>
      <ConfirmModal
        open={showConfirm}
        title="Deactivate Golfer"
        message="This golfer will stop receiving weekly invites. Their account and history will be preserved — you can reactivate them anytime."
        confirmLabel="Deactivate"
        variant="danger"
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          startTransition(async () => {
            await deactivateGolfer(profileId);
            showToast("Golfer deactivated");
          });
        }}
      />
    </>
  );
}

export function ReactivateButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await reactivateGolfer(profileId);
          showToast("Golfer reactivated");
        })
      }
      className="rounded-md bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
    >
      {isPending ? "Reactivating…" : "Reactivate"}
    </button>
  );
}
