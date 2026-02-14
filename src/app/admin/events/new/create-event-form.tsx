"use client";

import { useTransition, useState } from "react";
import { createEvent } from "./actions";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function CreateEventForm({
  activeGolfers,
}: {
  activeGolfers: { id: string; first_name: string; last_name: string; email: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [durationMode, setDurationMode] = useState("indefinite");
  const [numReminders, setNumReminders] = useState(1);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createEvent(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Basic Information
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Event Name *
          </label>
          <input
            name="name"
            required
            placeholder="e.g., FRCC Saturday Morning Group"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            name="description"
            rows={2}
            placeholder="Brief description shown in dashboards and emails"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Frequency
            </label>
            <select
              name="frequency"
              defaultValue="weekly"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Day of Week
            </label>
            <select
              name="day_of_week"
              defaultValue="6"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {DAY_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Max Capacity
            </label>
            <input
              name="default_capacity"
              type="number"
              min="1"
              defaultValue="16"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700">
            Minimum Players
          </label>
          <input
            name="min_players"
            type="number"
            min="1"
            placeholder="Optional"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Triggers alert if not met by cutoff.
          </p>
        </div>
      </section>

      {/* Duration */}
      <section className="space-y-3 rounded-md border border-gray-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Duration
        </h3>
        <div className="flex flex-wrap gap-3">
          {[
            { value: "indefinite", label: "Ongoing (no end date)" },
            { value: "fixed_weeks", label: "Fixed number of weeks" },
            { value: "end_date", label: "Specific end date" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="duration_mode"
                value={opt.value}
                checked={durationMode === opt.value}
                onChange={() => setDurationMode(opt.value)}
                className="text-green-700 focus:ring-green-500"
              />
              {opt.label}
            </label>
          ))}
        </div>

        {durationMode === "fixed_weeks" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Start Date
              </label>
              <input
                name="start_date"
                type="date"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Number of Weeks
              </label>
              <input
                name="duration_weeks"
                type="number"
                min="1"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {durationMode === "end_date" && (
          <div>
            <label className="block text-xs font-medium text-gray-600">
              End Date
            </label>
            <input
              name="end_date"
              type="date"
              className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </section>

      {/* Email Schedule */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Email Schedule
        </h3>

        <DayTimeInput label="Send Invite" dayName="invite_day" timeName="invite_time" dayDefault={1} timeDefault="10:00" />

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Reminders
          </label>
          <select
            name="num_reminders"
            value={numReminders}
            onChange={(e) => setNumReminders(parseInt(e.target.value))}
            className="mt-1 block w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>

        {numReminders >= 1 && (
          <DayTimeInput label="Reminder 1" dayName="reminder_day" timeName="reminder_time" dayDefault={4} timeDefault="10:00" />
        )}
        {numReminders >= 2 && (
          <DayTimeInput label="Reminder 2" dayName="reminder2_day" timeName="reminder2_time" dayDefault={4} timeDefault="16:00" />
        )}
        {numReminders >= 3 && (
          <DayTimeInput label="Reminder 3" dayName="reminder3_day" timeName="reminder3_time" dayDefault={5} timeDefault="08:00" />
        )}

        <DayTimeInput label="RSVP Cutoff" dayName="cutoff_day" timeName="cutoff_time" dayDefault={5} timeDefault="10:00" />
        <DayTimeInput label="Send Confirmation" dayName="confirmation_day" timeName="confirmation_time" dayDefault={5} timeDefault="13:00" />
      </section>

      {/* Primary Admin */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Primary Admin
        </h3>
        <p className="text-xs text-gray-500">
          The primary admin&apos;s email is used as the reply-to address and
          contact for questions.
        </p>
        <select
          name="primary_admin_id"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select primary admin (optional)...</option>
          {activeGolfers.map((g) => (
            <option key={g.id} value={g.id}>
              {g.first_name} {g.last_name} ({g.email})
            </option>
          ))}
        </select>
      </section>

      {/* Submit */}
      <div className="border-t border-gray-200 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-green-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
        >
          {isPending ? "Creating Event..." : "Create Event"}
        </button>
      </div>
    </form>
  );
}

function DayTimeInput({
  label,
  dayName,
  timeName,
  dayDefault,
  timeDefault,
}: {
  label: string;
  dayName: string;
  timeName: string;
  dayDefault: number;
  timeDefault: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[140px]">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <select
          name={dayName}
          defaultValue={dayDefault}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {DAY_NAMES.map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">at</label>
        <input
          name={timeName}
          type="time"
          defaultValue={timeDefault}
          className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
