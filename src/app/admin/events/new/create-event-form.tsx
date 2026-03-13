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

// Must match the cron slots in vercel.json — emails fire ~15 min after these times.
// See components.tsx in event settings for the full mapping.
const TIME_OPTIONS = [
  { value: "04:45", label: "4:45 AM" },
  { value: "05:45", label: "5:45 AM" },
  { value: "10:45", label: "10:45 AM" },
  { value: "11:45", label: "11:45 AM" },
  { value: "16:45", label: "4:45 PM" },
  { value: "17:45", label: "5:45 PM" },
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
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [proShopEnabled, setProShopEnabled] = useState(false);

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
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
                className="text-teal-600 focus:ring-teal-500"
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
          Automated Email Settings
        </h3>

        {/* Invite */}
        <DayTimeInput label="Send Invite" dayName="invite_day" timeName="invite_time" dayDefault={1} timeDefault="10:45" />

        {/* Reminder Section with Toggle */}
        <div className="space-y-4 rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Send Reminder Emails</p>
              <p className="text-xs text-gray-500">
                Send reminders to golfers who haven&apos;t responded
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReminderEnabled(!reminderEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                reminderEnabled ? "bg-teal-500" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  reminderEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {reminderEnabled && (
            <>
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
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>

              {numReminders >= 1 && (
                <DayTimeInput label="Reminder 1" dayName="reminder_day" timeName="reminder_time" dayDefault={4} timeDefault="05:45" />
              )}
              {numReminders >= 2 && (
                <DayTimeInput label="Reminder 2" dayName="reminder2_day" timeName="reminder2_time" dayDefault={4} timeDefault="16:45" />
              )}
              {numReminders >= 3 && (
                <DayTimeInput label="Reminder 3" dayName="reminder3_day" timeName="reminder3_time" dayDefault={5} timeDefault="04:45" />
              )}
            </>
          )}
        </div>

        {/* Hidden field to preserve num_reminders when reminders are disabled */}
        {!reminderEnabled && (
          <input type="hidden" name="num_reminders" value="0" />
        )}
        <input type="hidden" name="reminder_enabled" value={reminderEnabled ? "true" : "false"} />

        {/* Cutoff / Golfer Confirmation */}
        <DayTimeInput label="RSVP Cutoff / Golfer Confirmation" dayName="cutoff_day" timeName="cutoff_time" dayDefault={5} timeDefault="04:45" />

        {/* Pro Shop Detail Email with Toggle */}
        <div className="space-y-4 rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Send Pro Shop Detail Email</p>
              <p className="text-xs text-gray-500">
                Send player details and contact info to the pro shop
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProShopEnabled(!proShopEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                proShopEnabled ? "bg-teal-500" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  proShopEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {proShopEnabled && (
            <DayTimeInput label="Send Time" dayName="confirmation_day" timeName="confirmation_time" dayDefault={5} timeDefault="05:45" />
          )}
        </div>
        <input type="hidden" name="pro_shop_enabled" value={proShopEnabled ? "true" : "false"} />

        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          All times are Pacific Time. Emails are sent within approximately 15 minutes of the selected time.
        </p>
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
          className="rounded-md bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
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
        <select
          name={timeName}
          defaultValue={timeDefault}
          className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
