"use client";

import { ManualHandicapField } from "@/components/manual-handicap-field";
import { updateManualHandicap } from "./actions";

export function GolferManualHandicapField({
  profileId,
  manualHandicap,
  syncedHandicap,
}: {
  profileId: string;
  manualHandicap: number | null;
  syncedHandicap: number | null;
}) {
  return (
    <ManualHandicapField
      profileId={profileId}
      manualHandicap={manualHandicap}
      syncedHandicap={syncedHandicap}
      updateAction={updateManualHandicap}
    />
  );
}
