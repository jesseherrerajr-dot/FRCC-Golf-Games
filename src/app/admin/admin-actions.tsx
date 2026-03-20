"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import { useRouter } from "next/navigation";
import {
  approveRegistration,
  denyRegistration,
  deactivateGolfer,
  reactivateGolfer,
  permanentlyDeleteGolfer,
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

export function PermanentlyDeleteGolferButton({
  profileId,
  golferEmail,
}: {
  profileId: string;
  golferEmail: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const emailMatches = confirmEmail.trim().toLowerCase() === golferEmail.trim().toLowerCase();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await permanentlyDeleteGolfer(profileId, confirmEmail);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/admin/golfers");
      }
    });
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        Permanently Delete...
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">
        Permanently delete this golfer?
      </p>
      <p className="mt-1 text-xs text-red-600">
        This will delete the golfer and all their data (RSVPs, preferences,
        subscriptions, grouping history). This cannot be undone.
      </p>
      <p className="mt-2 text-xs text-red-800">
        Type the golfer&apos;s email to confirm:
      </p>
      <p className="mt-1 text-xs font-mono text-red-600">
        {golferEmail}
      </p>
      <input
        type="text"
        value={confirmEmail}
        onChange={(e) => {
          setConfirmEmail(e.target.value);
          setError(null);
        }}
        placeholder="Type email here"
        className="mt-2 w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
      />
      {error && (
        <p className="mt-2 text-xs text-red-700">{error}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleDelete}
          disabled={isPending || !emailMatches}
          className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Deleting..." : "Permanently Delete"}
        </button>
        <button
          onClick={() => {
            setShowConfirm(false);
            setConfirmEmail("");
            setError(null);
          }}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
