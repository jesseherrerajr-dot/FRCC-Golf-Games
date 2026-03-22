"use client";

import { ManualHandicapField } from "@/components/manual-handicap-field";
import { eventUpdateManualHandicap } from "./actions";

export function EventManualHandicapField({
  profileId,
  eventId,
  manualHandicap,
  syncedHandicap,
}: {
  profileId: string;
  eventId: string;
  manualHandicap: number | null;
  syncedHandicap: number | null;
}) {
  const handleUpdate = async (pid: string, handicapIndex: number | null) => {
    return eventUpdateManualHandicap(pid, handicapIndex, eventId);
  };

  return (
    <ManualHandicapField
      profileId={profileId}
      manualHandicap={manualHandicap}
      syncedHandicap={syncedHandicap}
      updateAction={handleUpdate}
    />
  );
}
