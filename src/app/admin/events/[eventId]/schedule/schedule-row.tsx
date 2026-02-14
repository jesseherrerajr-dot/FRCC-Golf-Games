"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { toggleGameStatus, updateWeekSettings } from "./actions";

interface ScheduleWithCounts {
  id: string;
  event_id: string;
  game_date: string;
  capacity: number | null;
  min_players_override: number | null;
  status: string;
  admin_notes: string | null;
  inCount: number;
  waitlistCount: number;
  effectiveCapacity: number;
  effectiveMinPlayers: number | null;
}

export function ScheduleRow({
  schedule,
  eventId,
  defaultCapacity,
  defaultMinPlayers,
}: {
  schedule: ScheduleWithCounts;
  eventId: string;
  defaultCapacity: number;
  defaultMinPlayers: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [capacity, setCapacity] = useState(
    schedule.capacity?.toString() || ""
  );
  const [minPlayers, setMinPlayers] = useState(
    schedule.min_players_override?.toString() || ""
  );
  const [notes, setNotes] = useState(schedule.admin_notes || "");

  const isCancelled = schedule.status === "cancelled";

  const formattedDate = new Date(
    schedule.game_date + "T12:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const fillPct = Math.min(
    (schedule.inCount / schedule.effectiveCapacity) * 100,
    100
  );

  const handleToggleStatus = () => {
    const newStatus = isCancelled ? "scheduled" : "cancelled";
    startTransition(async () => {
      await toggleGameStatus(schedule.id, eventId, newStatus);
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateWeekSettings(schedule.id, eventId, {
        capacity: capacity ? parseInt(capacity) : null,
        min_players_override: minPlayers ? parseInt(minPlayers) : null,
        admin_notes: notes.trim() || null,
      });
      setIsEditing(false);
    });
  };

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm ${
        isCancelled
          ? "border-red-200 opacity-70"
          : "border-gray-200"
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {formattedDate}
          </h3>
          {isCancelled && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Cancelled
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isCancelled && (
            <div className="text-right">
              <span className="text-sm font-bold text-teal-600">
                {schedule.inCount}/{schedule.effectiveCapacity}
              </span>
              {schedule.waitlistCount > 0 && (
                <span className="ml-2 text-xs text-orange-600">
                  +{schedule.waitlistCount} waitlist
                </span>
              )}
            </div>
          )}

          <Link
            href={`/admin/rsvp/${schedule.id}`}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            RSVPs
          </Link>

          <button
            onClick={handleToggleStatus}
            disabled={isPending}
            className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
              isCancelled
                ? "border border-teal-300 text-teal-600 hover:bg-navy-50"
                : "border border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            {isPending
              ? "..."
              : isCancelled
                ? "Restore"
                : "Cancel"}
          </button>

          {!isCancelled && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              {isEditing ? "Close" : "Edit"}
            </button>
          )}
        </div>
      </div>

      {/* Capacity Bar */}
      {!isCancelled && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${
              schedule.inCount >= schedule.effectiveCapacity
                ? "bg-red-500"
                : "bg-teal-500"
            }`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      )}

      {/* Admin Notes Display */}
      {schedule.admin_notes && !isEditing && (
        <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
          Note: {schedule.admin_notes}
        </p>
      )}

      {/* Edit Panel */}
      {isEditing && !isCancelled && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Capacity Override
              </label>
              <input
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder={`Default: ${defaultCapacity}`}
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Min Players Override
              </label>
              <input
                type="number"
                min="1"
                value={minPlayers}
                onChange={(e) => setMinPlayers(e.target.value)}
                placeholder={
                  defaultMinPlayers
                    ? `Default: ${defaultMinPlayers}`
                    : "Not set"
                }
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">
              Admin Note
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Appears in invite and confirmation emails (e.g., 'Cart path only this week')"
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
