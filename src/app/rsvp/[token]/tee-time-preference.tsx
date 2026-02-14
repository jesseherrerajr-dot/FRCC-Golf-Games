"use client";

import { useState } from "react";

type TeeTimePreference = "no_preference" | "early" | "late";

const preferenceLabels: Record<TeeTimePreference, string> = {
  no_preference: "No preference",
  early: "Please group me with an earlier tee time (if possible)",
  late: "Please group me with a later tee time (if possible)",
};

export function TeeTimePreference({
  token,
  currentPreference,
}: {
  token: string;
  currentPreference: TeeTimePreference;
}) {
  const [preference, setPreference] = useState<TeeTimePreference>(currentPreference);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleChange(newPreference: TeeTimePreference) {
    if (isUpdating || newPreference === preference) return;

    setIsUpdating(true);
    setPreference(newPreference);

    try {
      const response = await fetch(`/api/rsvp/tee-time?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preference: newPreference }),
      });

      if (!response.ok) {
        // Revert on error
        setPreference(preference);
        alert("Failed to update tee time preference. Please try again.");
      }
    } catch (error) {
      console.error("Error updating tee time preference:", error);
      setPreference(preference);
      alert("Failed to update tee time preference. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        Pro Shop will consider tee time preferences, but is unable to accommodate all requests.
      </p>

      <div className="space-y-2">
        {(["no_preference", "early", "late"] as TeeTimePreference[]).map((option) => (
          <label
            key={option}
            className={`flex items-start cursor-pointer ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              type="radio"
              name="tee_time_preference"
              value={option}
              checked={preference === option}
              onChange={() => handleChange(option)}
              disabled={isUpdating}
              className="mt-0.5 h-4 w-4 border-gray-300 text-teal-600 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed"
            />
            <span className="ml-3 text-sm text-gray-700">
              {preferenceLabels[option]}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
