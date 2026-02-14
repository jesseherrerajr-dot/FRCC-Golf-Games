"use client";

import { useTransition } from "react";
import {
  approveRegistration,
  denyRegistration,
  deactivateMember,
  reactivateMember,
} from "./actions";

export function ApproveButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(async () => { await approveRegistration(profileId); })}
      className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
    >
      {isPending ? "..." : "Approve"}
    </button>
  );
}

export function DenyButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (confirm("Deny this registration? They will be deactivated.")) {
          startTransition(async () => { await denyRegistration(profileId); });
        }
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "..." : "Deny"}
    </button>
  );
}

export function DeactivateButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (confirm("Deactivate this member? They will stop receiving invites.")) {
          startTransition(() => deactivateMember(profileId));
        }
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "..." : "Deactivate"}
    </button>
  );
}

export function ReactivateButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => reactivateMember(profileId))}
      className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
    >
      {isPending ? "..." : "Reactivate"}
    </button>
  );
}
