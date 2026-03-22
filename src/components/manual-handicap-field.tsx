"use client";

import { useState, useTransition } from "react";

interface ManualHandicapFieldProps {
  profileId: string;
  manualHandicap: number | null;
  syncedHandicap: number | null;
  updateAction: (profileId: string, handicapIndex: number | null) => Promise<{ error?: string; success?: boolean }>;
}

export function ManualHandicapField({
  profileId,
  manualHandicap,
  syncedHandicap,
  updateAction,
}: ManualHandicapFieldProps) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(manualHandicap?.toString() ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const hasManualOverride = manualHandicap !== null;

  const handleSave = () => {
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : parseFloat(trimmed);

    if (parsed !== null && (isNaN(parsed) || parsed < -10 || parsed > 54)) {
      setMessage("Enter a valid handicap (-10 to 54) or leave blank to clear.");
      return;
    }

    startTransition(async () => {
      const result = await updateAction(profileId, parsed);
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage(parsed !== null ? "Manual handicap saved." : "Manual override cleared.");
        setEditing(false);
        setTimeout(() => setMessage(null), 3000);
      }
    });
  };

  const handleClear = () => {
    startTransition(async () => {
      const result = await updateAction(profileId, null);
      if (result.error) {
        setMessage(result.error);
      } else {
        setValue("");
        setMessage("Manual override cleared.");
        setEditing(false);
        setTimeout(() => setMessage(null), 3000);
      }
    });
  };

  if (!editing) {
    return (
      <div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Manual Handicap</dt>
          <dd className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {hasManualOverride ? manualHandicap.toFixed(1) : "Not set"}
            </span>
            <button
              onClick={() => {
                setValue(manualHandicap?.toString() ?? "");
                setEditing(true);
              }}
              className="text-xs text-teal-600 hover:text-teal-800"
            >
              {hasManualOverride ? "Edit" : "Set"}
            </button>
          </dd>
        </div>
        {hasManualOverride && syncedHandicap != null && (
          <p className="mt-0.5 text-right text-xs text-amber-600">
            Overrides synced value of {syncedHandicap.toFixed(1)}
          </p>
        )}
        {message && (
          <p className="mt-1 text-right text-xs text-teal-600">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center">
        <dt className="text-gray-500">Manual Handicap</dt>
        <dd className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="-10"
            max="54"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 12.5"
            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            disabled={isPending}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-teal-500 px-2 py-1 text-xs text-white hover:bg-teal-600 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={isPending}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </dd>
      </div>
      {hasManualOverride && (
        <div className="mt-1 text-right">
          <button
            onClick={handleClear}
            disabled={isPending}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Clear override
          </button>
        </div>
      )}
      {message && (
        <p className={`mt-1 text-right text-xs ${message.includes("error") || message.includes("Enter") ? "text-red-600" : "text-teal-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
