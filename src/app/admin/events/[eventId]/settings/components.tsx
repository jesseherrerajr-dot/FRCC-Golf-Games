"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateEventBasicSettings,
  updateEmailScheduleSettings,
  updateEmailTypeEnabled,
  updateAlertSetting,
  addGlobalProShopContact,
  removeGlobalProShopContact,
  linkProShopContactToEvent,
  unlinkProShopContactFromEvent,
  updateGroupingEmailRecipients,
  assignEventAdmin,
  removeEventAdmin,
  updateFeatureFlags,
  updateGroupingPreferences,
  updateHandicapSyncEnabled,
  deactivateEvent,
  reactivateEvent,
  permanentlyDeleteEvent,
} from "./actions";
import type { AlertType, GroupingPartnerPrefMode, GroupingTeeTimePrefMode, GroupingMethod, FlightTeamPairing } from "@/types/events";
import { PARTNER_PREF_MODE_LABELS, TEE_TIME_PREF_MODE_LABELS, GROUPING_METHOD_LABELS, FLIGHT_TEAM_PAIRING_LABELS, isHandicapMethod } from "@/types/events";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Time options at :45 past each hour, each with a dedicated cron job that
// fires 15 minutes later on the hour. Six daily cron entries (vercel.json)
// are 1:1 with these options so emails send promptly after the configured time.
// Clustered in pairs (early morning, midday, evening) so that staggered
// emails (e.g., golfer confirmation + pro shop detail) stay in close proximity.
//
// Dropdown → Cron (PST) → UTC
//   4:45 AM →  5:00 AM  → 0 13 * * *
//   5:45 AM →  6:00 AM  → 0 14 * * *
//  10:45 AM → 11:00 AM  → 0 19 * * *
//  11:45 AM → 12:00 PM  → 0 20 * * *
//   4:45 PM →  5:00 PM  → 0  1 * * *
//   5:45 PM →  6:00 PM  → 0  2 * * *
//
// Note: During PDT (Mar–Nov), crons fire 1 hour later in Pacific Time.
// The 3-hour send window in isWithinSendWindow() still catches every slot.
const TIME_OPTIONS = [
  { value: "04:45", label: "4:45 AM" },
  { value: "05:45", label: "5:45 AM" },
  { value: "10:45", label: "10:45 AM" },
  { value: "11:45", label: "11:45 AM" },
  { value: "16:45", label: "4:45 PM" },
  { value: "17:45", label: "5:45 PM" },
];

/**
 * Snap a time string (HH:MM) to the nearest :45 option.
 * Used to migrate existing free-form times to the constrained dropdown.
 */
function snapToNearest45(time: string | undefined | null): string {
  if (!time) return "10:45"; // default
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  // If already :45 and in our options, use as-is
  if (m === 45) {
    const val = `${String(h).padStart(2, "0")}:45`;
    if (TIME_OPTIONS.some((o) => o.value === val)) return val;
  }
  // Find the closest available option
  const totalMinutes = h * 60 + m;
  let closest = TIME_OPTIONS[0].value;
  let closestDiff = Infinity;
  for (const opt of TIME_OPTIONS) {
    const [oh, om] = opt.value.split(":").map(Number);
    const diff = Math.abs(oh * 60 + om - totalMinutes);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = opt.value;
    }
  }
  return closest;
}

// ============================================================
// Basic Settings Form
// ============================================================

export function BasicSettingsForm({ event }: { event: any }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>(event.slug || "");

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateEventBasicSettings(event.id, formData);
      setMessage(result.error || "Settings saved successfully.");
      if (!result.error) setTimeout(() => setMessage(null), 3000);
    });
  };

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Event Name
          </label>
          <input
            name="name"
            defaultValue={event.name}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            name="description"
            defaultValue={event.description || ""}
            rows={2}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            URL Slug
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="e.g., thursday-league"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            {!slug && (
              <button
                type="button"
                onClick={() => setSlug(generateSlug(event.name || ""))}
                className="shrink-0 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Generate
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Used for the golfer self-registration link (e.g., frccgolfgames.com/join/<strong>{slug || "your-slug"}</strong>). Letters, numbers, and hyphens only.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Frequency
          </label>
          <select
            name="frequency"
            defaultValue={event.frequency}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
            defaultValue={event.day_of_week}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
            defaultValue={event.default_capacity}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Minimum Players
          </label>
          <input
            name="min_players"
            type="number"
            min="1"
            defaultValue={event.min_players || ""}
            placeholder="Optional"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Triggers a low-response alert if not met by cutoff.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Game Type
          </label>
          <select
            name="game_type"
            defaultValue={event.game_type || "18_holes"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="18_holes">18 Holes (~4.5 hours)</option>
            <option value="9_holes">9 Holes (~2.5 hours)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            First Tee Time
          </label>
          <input
            name="first_tee_time"
            type="time"
            defaultValue={event.first_tee_time || "07:30"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            When the first group typically tees off. Used for weather forecasts.
          </p>
        </div>
      </div>

      {/* Duration Mode */}
      <DurationModeSection event={event} />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Settings"}
        </button>
        {message && (
          <p
            className={`text-sm ${message.includes("error") || message.includes("Failed") ? "text-red-600" : "text-teal-500"}`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}

function DurationModeSection({ event }: { event: any }) {
  const [mode, setMode] = useState(event.duration_mode || "indefinite");

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-4">
      <label className="block text-sm font-medium text-gray-700">
        Event Duration
      </label>
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
              checked={mode === opt.value}
              onChange={() => setMode(opt.value)}
              className="text-teal-600 focus:ring-teal-500"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {mode === "fixed_weeks" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Start Date
            </label>
            <input
              name="start_date"
              type="date"
              defaultValue={event.start_date || ""}
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
              defaultValue={event.duration_weeks || ""}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {mode === "end_date" && (
        <div>
          <label className="block text-xs font-medium text-gray-600">
            End Date
          </label>
          <input
            name="end_date"
            type="date"
            defaultValue={event.end_date || ""}
            className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Email Schedule Form
// ============================================================

export function EmailScheduleForm({
  event,
  emailSchedules,
}: {
  event: any;
  emailSchedules: { email_type: string; priority_order: number; is_enabled: boolean }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [numReminders, setNumReminders] = useState(event.num_reminders || 1);
  // A counter that increments on successful save, used as a React key
  // to force DayTimeRow components to remount with fresh values from the DB.
  const [saveCount, setSaveCount] = useState(0);

  // Derive initial enabled states from email_schedules rows
  const getIsEnabled = (emailType: string) => {
    const row = emailSchedules.find((s) => s.email_type === emailType);
    // Default to true for invite/golfer_confirmation (always on),
    // false for pro_shop_detail (off by default), true for reminder if row exists
    if (!row) {
      if (emailType === "pro_shop_detail") return false;
      return true;
    }
    return row.is_enabled;
  };

  const [reminderEnabled, setReminderEnabled] = useState(getIsEnabled("reminder"));
  const [proShopEnabled, setProShopEnabled] = useState(getIsEnabled("pro_shop_detail"));

  const handleSubmit = (formData: FormData) => {
    // Inject toggle states into form data so syncEmailSchedules can use them
    formData.set("reminder_enabled", reminderEnabled ? "true" : "false");
    formData.set("pro_shop_enabled", proShopEnabled ? "true" : "false");
    startTransition(async () => {
      const result = await updateEmailScheduleSettings(event.id, formData);
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage("Email schedule saved.");
        setSaveCount((c) => c + 1);
        setTimeout(() => setMessage(null), 3000);
      }
    });
  };

  const handleToggle = (
    emailType: "reminder" | "pro_shop_detail",
    newValue: boolean,
    setter: (v: boolean) => void
  ) => {
    setter(newValue);
    startTransition(async () => {
      const result = await updateEmailTypeEnabled(event.id, emailType, newValue);
      if (result?.error) {
        // Revert on failure
        setter(!newValue);
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-5" key={saveCount}>
      {/* Invite */}
      <DayTimeRow
        label="Send Invite"
        dayName="invite_day"
        timeName="invite_time"
        dayDefault={event.invite_day}
        timeDefault={event.invite_time?.slice(0, 5)}
      />

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
            onClick={() => handleToggle("reminder", !reminderEnabled, setReminderEnabled)}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
              reminderEnabled ? "bg-teal-500" : "bg-gray-200"
            } ${isPending ? "opacity-50" : ""}`}
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
            {/* Number of Reminders */}
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

            {/* Reminder 1 */}
            {numReminders >= 1 && (
              <DayTimeRow
                label="Reminder 1"
                dayName="reminder_day"
                timeName="reminder_time"
                dayDefault={event.reminder_day}
                timeDefault={event.reminder_time?.slice(0, 5)}
              />
            )}

            {/* Reminder 2 */}
            {numReminders >= 2 && (
              <DayTimeRow
                label="Reminder 2"
                dayName="reminder2_day"
                timeName="reminder2_time"
                dayDefault={event.reminder2_day ?? 4}
                timeDefault={event.reminder2_time?.slice(0, 5) ?? "15:45"}
              />
            )}

            {/* Reminder 3 */}
            {numReminders >= 3 && (
              <DayTimeRow
                label="Reminder 3"
                dayName="reminder3_day"
                timeName="reminder3_time"
                dayDefault={event.reminder3_day ?? 5}
                timeDefault={event.reminder3_time?.slice(0, 5) ?? "07:45"}
              />
            )}
          </>
        )}
      </div>

      {/* Hidden field to preserve num_reminders when reminders are disabled */}
      {!reminderEnabled && (
        <input type="hidden" name="num_reminders" value="0" />
      )}

      {/* Cutoff / Golfer Confirmation */}
      <DayTimeRow
        label="RSVP Cutoff / Golfer Confirmation"
        dayName="cutoff_day"
        timeName="cutoff_time"
        dayDefault={event.cutoff_day}
        timeDefault={event.cutoff_time?.slice(0, 5)}
      />

      {/* Suggested Groupings Email with Toggle */}
      <div className="space-y-4 rounded-md border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Send Suggested Groupings Email</p>
            <p className="text-xs text-gray-500">
              Send player details and suggested groupings after cutoff
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle("pro_shop_detail", !proShopEnabled, setProShopEnabled)}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
              proShopEnabled ? "bg-teal-500" : "bg-gray-200"
            } ${isPending ? "opacity-50" : ""}`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                proShopEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {proShopEnabled && (
          <>
            <DayTimeRow
              label="Send Time"
              dayName="confirmation_day"
              timeName="confirmation_time"
              dayDefault={event.confirmation_day}
              timeDefault={event.confirmation_time?.slice(0, 5)}
            />

            {/* Recipient Checkboxes */}
            <GroupingEmailRecipients eventId={event.id} event={event} />
          </>
        )}
      </div>

      <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        All times are Pacific Time. Emails are sent within approximately 15 minutes of the selected time.
      </p>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Email Schedule"}
        </button>
        {message && (
          <p
            className={`text-sm ${message.includes("error") || message.includes("Failed") || message.includes("failed") ? "text-red-600" : "text-teal-500"}`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}

function DayTimeRow({
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
  const snappedTime = snapToNearest45(timeDefault);

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
          defaultValue={snappedTime}
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

// ============================================================
// Grouping Email Recipient Checkboxes
// ============================================================

function GroupingEmailRecipients({ eventId, event }: { eventId: string; event: any }) {
  const [isPending, startTransition] = useTransition();
  const [sendToProshop, setSendToProshop] = useState<boolean>(event.grouping_email_send_to_proshop ?? true);
  const [sendToAdmins, setSendToAdmins] = useState<boolean>(event.grouping_email_send_to_admins ?? true);
  const [sendToGolfers, setSendToGolfers] = useState<boolean>(event.grouping_email_send_to_golfers ?? false);

  const handleToggle = (
    key: "grouping_email_send_to_proshop" | "grouping_email_send_to_admins" | "grouping_email_send_to_golfers",
    newValue: boolean,
    setter: (v: boolean) => void
  ) => {
    setter(newValue);
    startTransition(async () => {
      await updateGroupingEmailRecipients(eventId, { [key]: newValue });
    });
  };

  const recipientOptions = [
    {
      key: "grouping_email_send_to_proshop" as const,
      label: "Pro Shop Contacts",
      description: "Send to pro shop contacts linked to this event",
      checked: sendToProshop,
      setter: setSendToProshop,
    },
    {
      key: "grouping_email_send_to_admins" as const,
      label: "Event Admins",
      description: "Send to all admins assigned to this event",
      checked: sendToAdmins,
      setter: setSendToAdmins,
    },
    {
      key: "grouping_email_send_to_golfers" as const,
      label: "Confirmed Golfers",
      description: "Send to all golfers confirmed for that week",
      checked: sendToGolfers,
      setter: setSendToGolfers,
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700">Send to:</p>
      {recipientOptions.map((opt) => (
        <label
          key={opt.key}
          className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
            opt.checked ? "border-teal-200 bg-teal-50" : "border-gray-200 bg-white"
          } ${isPending ? "opacity-50" : ""}`}
        >
          <input
            type="checkbox"
            checked={opt.checked}
            onChange={() => handleToggle(opt.key, !opt.checked, opt.setter)}
            disabled={isPending}
            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">{opt.label}</p>
            <p className="text-xs text-gray-500">{opt.description}</p>
          </div>
        </label>
      ))}
      {!sendToProshop && !sendToAdmins && !sendToGolfers && (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          No recipients selected. The email won&apos;t be sent to anyone even if the toggle is on.
        </p>
      )}
    </div>
  );
}

// ============================================================
// Alert Settings Form
// ============================================================

const ALERT_LABELS: Record<AlertType, { label: string; description: string }> =
  {
    new_registration: {
      label: "New Registration",
      description: "Email when a new golfer registers and needs approval",
    },
    capacity_reached: {
      label: "Capacity Reached",
      description: "Email when a game hits capacity and waitlist forms",
    },
    spot_opened: {
      label: "Spot Opened",
      description: "Email when a confirmed player drops out",
    },
    low_response: {
      label: "Low Response Warning",
      description:
        "Email when confirmed count is below minimum player threshold",
    },
  };

export function AlertSettingsForm({
  eventId,
  alertSettings,
}: {
  eventId: string;
  alertSettings: any[];
}) {
  return (
    <div className="space-y-4">
      {(
        [
          "new_registration",
          "capacity_reached",
          "spot_opened",
          "low_response",
        ] as AlertType[]
      ).map((alertType) => {
        const setting = alertSettings.find((s) => s.alert_type === alertType);
        return (
          <AlertToggle
            key={alertType}
            eventId={eventId}
            alertType={alertType}
            isEnabled={setting?.is_enabled ?? false}
            config={setting?.config}
          />
        );
      })}
    </div>
  );
}

function AlertToggle({
  eventId,
  alertType,
  isEnabled,
  config,
}: {
  eventId: string;
  alertType: AlertType;
  isEnabled: boolean;
  config: any;
}) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(isEnabled);
  const info = ALERT_LABELS[alertType];

  const toggle = () => {
    const newVal = !enabled;
    setEnabled(newVal);
    startTransition(async () => {
      await updateAlertSetting(
        eventId,
        alertType,
        newVal,
        alertType === "low_response" ? config : undefined
      );
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{info.label}</p>
        <p className="text-xs text-gray-500">{info.description}</p>
        {alertType === "low_response" && enabled && (
          <LowResponseConfig eventId={eventId} config={config} />
        )}
      </div>
      <button
        onClick={toggle}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
          enabled ? "bg-teal-500" : "bg-gray-200"
        } ${isPending ? "opacity-50" : ""}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function LowResponseConfig({
  eventId,
  config,
}: {
  eventId: string;
  config: any;
}) {
  const [isPending, startTransition] = useTransition();

  const handleSave = (formData: FormData) => {
    const day = parseInt(formData.get("low_response_day") as string);
    const time = formData.get("low_response_time") as string;
    startTransition(async () => {
      await updateAlertSetting(eventId, "low_response", true, { day, time });
    });
  };

  return (
    <form action={handleSave} className="mt-2 flex items-end gap-2">
      <div>
        <label className="block text-xs text-gray-500">Check on</label>
        <select
          name="low_response_day"
          defaultValue={config?.day ?? 4}
          className="mt-0.5 block rounded border border-gray-300 px-2 py-1 text-xs"
        >
          {DAY_NAMES.map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500">at</label>
        <input
          name="low_response_time"
          type="time"
          defaultValue={config?.time ?? "17:00"}
          className="mt-0.5 block rounded border border-gray-300 px-2 py-1 text-xs"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {isPending ? "..." : "Update"}
      </button>
    </form>
  );
}

// ============================================================
// Pro Shop Contacts Section (Global Directory + Event Links)
// ============================================================

export function ProShopContactsSection({
  eventId,
  linkedContacts,
  allGlobalContacts,
  isSuperAdmin,
}: {
  eventId: string;
  linkedContacts: any[];
  allGlobalContacts: any[];
  isSuperAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedContactId, setSelectedContactId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);

  // Contacts already linked to this event (by contact_id)
  const linkedContactIds = new Set(
    linkedContacts.map((lc: any) => lc.contact_id)
  );

  // Available contacts to add (not already linked)
  const availableContacts = allGlobalContacts.filter(
    (c: any) => !linkedContactIds.has(c.id)
  );

  const handleLink = () => {
    if (!selectedContactId) return;
    setError(null);
    startTransition(async () => {
      const result = await linkProShopContactToEvent(eventId, selectedContactId);
      if (result.error) {
        setError(result.error);
      } else {
        setSelectedContactId("");
      }
    });
  };

  const handleUnlink = (contactId: string, contactName: string) => {
    if (confirm(`Remove ${contactName} from this event?`)) {
      startTransition(async () => {
        const result = await unlinkProShopContactFromEvent(eventId, contactId);
        if (result.error) setError(result.error);
      });
    }
  };

  const handleAddNewGlobal = () => {
    if (!newEmail.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addGlobalProShopContact(newEmail, newName || undefined);
      if (result.error) {
        setError(result.error);
      } else if (result.contactId) {
        // Also link to this event immediately
        await linkProShopContactToEvent(eventId, result.contactId);
        setNewName("");
        setNewEmail("");
        setShowAddNew(false);
      }
    });
  };

  const handleDeleteGlobal = (contactId: string, contactName: string) => {
    if (confirm(`Permanently delete ${contactName} from all events? This cannot be undone.`)) {
      startTransition(async () => {
        const result = await removeGlobalProShopContact(contactId);
        if (result.error) setError(result.error);
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Currently linked contacts */}
      {linkedContacts.length === 0 ? (
        <p className="text-sm text-gray-500">No pro shop contacts linked to this event.</p>
      ) : (
        <ul className="space-y-2">
          {linkedContacts.map((link: any) => {
            const contact = link.contact;
            if (!contact) return null;
            return (
              <li key={link.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">{contact.name}</span>
                  <span className="ml-1 text-sm text-gray-500">— {contact.email}</span>
                </div>
                <div className="ml-2 flex items-center gap-2">
                  <button
                    onClick={() => handleUnlink(contact.id, contact.name)}
                    disabled={isPending}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {isPending ? "..." : "Remove"}
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleDeleteGlobal(contact.id, contact.name)}
                      disabled={isPending}
                      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="Delete from all events"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Add from existing global contacts */}
      {availableContacts.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          <select
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
            className="block flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select a contact to add...</option>
            {availableContacts.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <button
            onClick={handleLink}
            disabled={isPending || !selectedContactId}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {isPending ? "..." : "Add to Event"}
          </button>
        </div>
      )}

      {/* Add a new global contact (super admin only) */}
      {isSuperAdmin && (
        <div className="border-t border-gray-100 pt-3">
          {!showAddNew ? (
            <button
              onClick={() => setShowAddNew(true)}
              className="text-sm font-medium text-teal-600 hover:text-teal-500"
            >
              + New Pro Shop Contact
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Add a new pro shop contact</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contact name"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto sm:flex-1"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto sm:flex-1"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddNewGlobal}
                  disabled={isPending || !newEmail.trim()}
                  className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  {isPending ? "..." : "Add & Link to Event"}
                </button>
                <button
                  onClick={() => { setShowAddNew(false); setNewName(""); setNewEmail(""); setError(null); }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-500">
                This contact will be added to the global directory and linked to this event. It can be reused across other events.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Admin Assignments Form (Super Admin Only)
// ============================================================

export function AdminAssignmentsForm({
  eventId,
  eventAdmins,
  activeGolfers,
}: {
  eventId: string;
  eventAdmins: any[];
  activeGolfers: any[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedGolfer, setSelectedGolfer] = useState("");
  const [selectedRole, setSelectedRole] = useState<"primary" | "secondary">(
    "secondary"
  );

  const assignedIds = new Set(eventAdmins.map((a: any) => a.profile_id));
  const availableGolfers = activeGolfers.filter(
    (g: any) => !assignedIds.has(g.id)
  );

  const handleAssign = () => {
    if (!selectedGolfer) return;
    startTransition(async () => {
      await assignEventAdmin(eventId, selectedGolfer, selectedRole);
      setSelectedGolfer("");
    });
  };

  return (
    <div className="space-y-4">
      {eventAdmins.length === 0 ? (
        <p className="text-sm text-gray-500">No admins assigned.</p>
      ) : (
        <ul className="space-y-2">
          {eventAdmins.map((admin: any) => (
            <AdminRow
              key={admin.id}
              admin={admin}
              eventId={eventId}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <select
          value={selectedGolfer}
          onChange={(e) => setSelectedGolfer(e.target.value)}
          className="block flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select a golfer...</option>
          {availableGolfers.map((g: any) => (
            <option key={g.id} value={g.id}>
              {g.first_name} {g.last_name} ({g.email})
            </option>
          ))}
        </select>
        <select
          value={selectedRole}
          onChange={(e) =>
            setSelectedRole(e.target.value as "primary" | "secondary")
          }
          className="block rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
        </select>
        <button
          onClick={handleAssign}
          disabled={isPending || !selectedGolfer}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {isPending ? "..." : "Assign"}
        </button>
      </div>
    </div>
  );
}

function AdminRow({ admin, eventId }: { admin: any; eventId: string }) {
  const [isPending, startTransition] = useTransition();
  const profile = admin.profile as {
    first_name: string;
    last_name: string;
    email: string;
  };

  const handleRemove = () => {
    if (
      confirm(
        `Remove ${profile.first_name} ${profile.last_name} as event admin?`
      )
    ) {
      startTransition(async () => {
        await removeEventAdmin(eventId, admin.profile_id);
      });
    }
  };

  return (
    <li className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <div>
        <span className="text-sm font-medium text-gray-900">
          {profile.first_name} {profile.last_name}
        </span>
        <span className="ml-2 text-xs text-gray-500">{profile.email}</span>
        <span
          className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            admin.role === "primary"
              ? "bg-teal-100 text-teal-600"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {admin.role}
        </span>
      </div>
      <button
        onClick={handleRemove}
        disabled={isPending}
        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {isPending ? "..." : "Remove"}
      </button>
    </li>
  );
}

// ============================================================
// Feature Flags Form (Super Admin Only)
// ============================================================

// ============================================================
// Grouping Preferences Form
// ============================================================

const PARTNER_MODES: GroupingPartnerPrefMode[] = ['off', 'light', 'moderate', 'full'];
const TEE_TIME_MODES: GroupingTeeTimePrefMode[] = ['light', 'moderate', 'full'];
const GROUPING_METHODS: GroupingMethod[] = ['harmony', 'flight_foursomes', 'balanced_foursomes', 'flight_teams', 'balanced_teams'];
const FLIGHT_TEAM_PAIRINGS: FlightTeamPairing[] = ['similar', 'random'];

export function GroupingPreferencesForm({ event }: { event: any }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const autoGroupingEnabled: boolean = event.allow_auto_grouping || false;
  const partnerEnabled: boolean = event.allow_playing_partner_preferences || false;
  const teeTimeEnabled: boolean = event.allow_tee_time_preferences || false;
  const partnerMode: GroupingPartnerPrefMode = event.grouping_partner_pref_mode || 'full';
  const teeTimeMode: GroupingTeeTimePrefMode = event.grouping_tee_time_pref_mode || 'full';
  const promoteVariety: boolean = event.grouping_promote_variety || false;
  const groupingMethod: GroupingMethod = event.grouping_method || 'harmony';
  const flightTeamPairing: FlightTeamPairing = event.flight_team_pairing || 'similar';
  const isHandicap = isHandicapMethod(groupingMethod);

  // When grouping is off entirely, disable all sub-settings
  const isDisabled = !autoGroupingEnabled;

  const showMessage = (msg: string, isError?: boolean) => {
    setMessage(msg);
    if (!isError) setTimeout(() => setMessage(null), 3000);
  };

  const handleAutoGroupingToggle = () => {
    startTransition(async () => {
      const result = await updateFeatureFlags(event.id, {
        allow_auto_grouping: !autoGroupingEnabled,
      });
      if (result.error) {
        showMessage(result.error, true);
        return;
      }
      showMessage(!autoGroupingEnabled ? "Grouping engine enabled." : "Grouping engine disabled. Groups will follow RSVP order.");
    });
  };

  const handleMethodChange = (method: GroupingMethod) => {
    startTransition(async () => {
      const result = await updateGroupingPreferences(event.id, {
        grouping_method: method,
      });
      if (result.error) {
        showMessage(result.error, true);
        return;
      }
      // When selecting Partner Preferences method, auto-enable the partner preferences feature
      if (method === 'harmony' && !partnerEnabled) {
        await updateFeatureFlags(event.id, { allow_playing_partner_preferences: true });
        showMessage("Grouping method updated. Playing partner preferences have been turned on automatically.");
      } else {
        showMessage("Grouping method updated.");
      }
    });
  };

  const handleFlightTeamPairingChange = (pairing: FlightTeamPairing) => {
    startTransition(async () => {
      const result = await updateGroupingPreferences(event.id, {
        flight_team_pairing: pairing,
      });
      showMessage(result.error || "Team pairing mode updated.", !!result.error);
    });
  };

  const handleFeatureToggle = (key: string, currentValue: boolean) => {
    startTransition(async () => {
      const result = await updateFeatureFlags(event.id, { [key]: !currentValue });
      if (result.error) {
        showMessage(result.error, true);
        return;
      }
      if (!currentValue) {
        if (key === 'allow_tee_time_preferences' && teeTimeMode === 'off') {
          await updateGroupingPreferences(event.id, { grouping_tee_time_pref_mode: 'full' });
        }
        if (key === 'allow_playing_partner_preferences' && partnerMode === 'off') {
          await updateGroupingPreferences(event.id, { grouping_partner_pref_mode: 'full' });
        }
      }
      showMessage(!currentValue ? "Enabled." : "Disabled.");
    });
  };

  const handlePartnerModeChange = (mode: GroupingPartnerPrefMode) => {
    startTransition(async () => {
      const result = await updateGroupingPreferences(event.id, {
        grouping_partner_pref_mode: mode,
      });
      showMessage(result.error || "Partner preference mode updated.", !!result.error);
    });
  };

  const handleTeeTimeModeChange = (mode: GroupingTeeTimePrefMode) => {
    startTransition(async () => {
      const result = await updateGroupingPreferences(event.id, {
        grouping_tee_time_pref_mode: mode,
      });
      showMessage(result.error || "Tee time preference mode updated.", !!result.error);
    });
  };

  const handleVarietyToggle = () => {
    startTransition(async () => {
      const result = await updateGroupingPreferences(event.id, {
        grouping_promote_variety: !promoteVariety,
      });
      showMessage(result.error || (promoteVariety ? "Group variety disabled." : "Group variety enabled."), !!result.error);
    });
  };

  return (
    <div className="space-y-6">
      {/* Status message */}
      {message && (
        <p className={`rounded-md p-2 text-xs ${
          message.includes("Failed") || message.includes("error")
            ? "bg-red-50 text-red-700"
            : "bg-teal-50 text-teal-700"
        }`}>
          {message}
        </p>
      )}

      {/* Master on/off toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Enable Grouping Engine</p>
          <p className="mt-0.5 text-xs text-gray-500">
            When off, groups are based on the order golfers RSVP. Turn on to use an algorithm for suggested groupings.
          </p>
        </div>
        <button
          onClick={handleAutoGroupingToggle}
          disabled={isPending}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
            autoGroupingEnabled ? "bg-teal-500" : "bg-gray-200"
          } ${isPending ? "opacity-50" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
              autoGroupingEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Off state info banner */}
      {!autoGroupingEnabled && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs text-gray-600">
            The grouping engine is currently off. Golfers will be grouped in the order they RSVP&rsquo;d. Turn it on above to configure an algorithm for suggested groupings.
          </p>
        </div>
      )}

      {/* All settings below are disabled when grouping is off */}
      <div className={isDisabled ? "opacity-40 pointer-events-none" : ""}>

        {/* Divider */}
        <hr className="border-gray-200" />

        {/* Grouping Method Selector */}
        <div className="mt-6">
          <p className="text-sm font-medium text-gray-900">Grouping Method</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Choose how the engine forms groups. Handicap-based methods use GHIN data to organize players by skill level.
          </p>
          <div className="mt-3 space-y-2">
            {GROUPING_METHODS.map((method) => {
              const meta = GROUPING_METHOD_LABELS[method];
              const isSelected = groupingMethod === method;
              return (
                <label
                  key={method}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  } ${isPending ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <input
                    type="radio"
                    name="grouping_method"
                    value={method}
                    checked={isSelected}
                    onChange={() => handleMethodChange(method)}
                    disabled={isPending || isDisabled}
                    className="mt-0.5 h-4 w-4 text-teal-500 focus:ring-teal-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                    <p className="text-xs text-gray-500">{meta.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Flight Team Pairing — only shown when method is flight_teams */}
        {groupingMethod === 'flight_teams' && (
          <>
            <hr className="mt-6 border-gray-200" />
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-900">Team Pairing Mode</p>
              <p className="mt-0.5 text-xs text-gray-500">
                After 2-person teams are formed by skill tier, choose how teams are paired into foursomes.
              </p>
              <div className="mt-3 space-y-2">
                {FLIGHT_TEAM_PAIRINGS.map((pairing) => {
                  const meta = FLIGHT_TEAM_PAIRING_LABELS[pairing];
                  const isSelected = flightTeamPairing === pairing;
                  return (
                    <label
                      key={pairing}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? "border-teal-500 bg-teal-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      } ${isPending ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <input
                        type="radio"
                        name="flight_team_pairing"
                        value={pairing}
                        checked={isSelected}
                        onChange={() => handleFlightTeamPairingChange(pairing)}
                        disabled={isPending || isDisabled}
                        className="mt-0.5 h-4 w-4 text-teal-500 focus:ring-teal-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                        <p className="text-xs text-gray-500">{meta.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Handicap method warning banner */}
        {isHandicap && (
          <>
            <hr className="mt-6 border-gray-200" />
            <div className="mt-6 rounded-md bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-800">
                Handicap-based grouping is active
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Playing partner preferences, tee time preferences, and group variety settings below are overridden
                when using a handicap-based method. Groups are formed entirely by skill level.
                Switch back to &ldquo;Partner Preferences&rdquo; to re-enable those controls.
              </p>
            </div>
          </>
        )}

        {/* Partner Preferences dependency note */}
        {groupingMethod === 'harmony' && !partnerEnabled && autoGroupingEnabled && (
          <>
            <hr className="mt-6 border-gray-200" />
            <div className="mt-6 rounded-md bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs font-medium text-blue-800">
                Playing partner preferences are currently off
              </p>
              <p className="mt-1 text-xs text-blue-700">
                The Partner Preferences grouping method works best when golfers can set their preferred playing partners.
                Turn on Playing Partner Preferences below, or groups will be effectively random.
              </p>
            </div>
          </>
        )}

        {/* Divider */}
        <hr className="mt-6 border-gray-200" />

        {/* Playing Partner Preferences — toggle + mode selector */}
        <div className={`mt-6 ${isHandicap ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Playing Partner Preferences</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Allow golfers to select preferred playing partners and control how those preferences influence suggested tee time groupings.
              </p>
            </div>
            <button
              onClick={() => handleFeatureToggle('allow_playing_partner_preferences', partnerEnabled)}
              disabled={isPending || isHandicap || isDisabled}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                partnerEnabled && !isHandicap ? "bg-teal-500" : "bg-gray-200"
              } ${isPending ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  partnerEnabled && !isHandicap ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {partnerEnabled && !isHandicap && (
            <div className="mt-3 space-y-2">
              {PARTNER_MODES.map((mode) => {
                const meta = PARTNER_PREF_MODE_LABELS[mode];
                const isSelected = partnerMode === mode;
                return (
                  <label
                    key={mode}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? "border-teal-500 bg-teal-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    } ${isPending ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <input
                      type="radio"
                      name="partner_mode"
                      value={mode}
                      checked={isSelected}
                      onChange={() => handlePartnerModeChange(mode)}
                      disabled={isPending || isDisabled}
                      className="mt-0.5 h-4 w-4 text-teal-500 focus:ring-teal-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                      <p className="text-xs text-gray-500">{meta.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <hr className="mt-6 border-gray-200" />

        {/* Tee Time Preferences — toggle + mode selector */}
        <div className={`mt-6 ${isHandicap ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Tee Time Preferences</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Allow golfers to indicate early/late tee time preference and control how those preferences influence group placement.
              </p>
            </div>
            <button
              onClick={() => handleFeatureToggle('allow_tee_time_preferences', teeTimeEnabled)}
              disabled={isPending || isHandicap || isDisabled}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                teeTimeEnabled && !isHandicap ? "bg-teal-500" : "bg-gray-200"
              } ${isPending ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  teeTimeEnabled && !isHandicap ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {teeTimeEnabled && !isHandicap && (
            <div className="mt-3 space-y-2">
              {TEE_TIME_MODES.map((mode) => {
                const meta = TEE_TIME_PREF_MODE_LABELS[mode];
                const isSelected = teeTimeMode === mode;
                return (
                  <label
                    key={mode}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? "border-teal-500 bg-teal-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    } ${isPending ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <input
                      type="radio"
                      name="tee_time_mode"
                      value={mode}
                      checked={isSelected}
                      onChange={() => handleTeeTimeModeChange(mode)}
                      disabled={isPending || isDisabled}
                      className="mt-0.5 h-4 w-4 text-teal-500 focus:ring-teal-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                      <p className="text-xs text-gray-500">{meta.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <hr className="mt-6 border-gray-200" />

        {/* Promote Group Variety */}
        <div className={`mt-6 flex items-start justify-between gap-4 ${isHandicap ? "opacity-50 pointer-events-none" : ""}`}>
          <div>
            <p className="text-sm font-medium text-gray-900">Promote Group Variety</p>
            <p className="text-xs text-gray-500">
              When enabled, the engine uses the last 8 weeks of grouping history to reduce repeat pairings.
              Golfers who were recently grouped together will be less likely to be paired again.
            </p>
          </div>
          <button
            onClick={handleVarietyToggle}
            disabled={isPending || isHandicap || isDisabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
              promoteVariety && !isHandicap ? "bg-teal-500" : "bg-gray-200"
            } ${isPending ? "opacity-50" : ""}`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                promoteVariety && !isHandicap ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

      </div>{/* end isDisabled wrapper */}
    </div>
  );
}

// ============================================================
// Feature Flags Form
// ============================================================

export function FeatureFlagsForm({ event }: { event: any }) {
  const [isPending, startTransition] = useTransition();

  const flags = [
    {
      key: "allow_guest_requests",
      label: "Guest Requests",
      description: "Allow golfers to request to bring guests",
    },
  ];

  const handleToggle = (key: string, currentValue: boolean) => {
    startTransition(async () => {
      await updateFeatureFlags(event.id, { [key]: !currentValue });
    });
  };

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-yellow-50 p-3 text-xs text-yellow-700">
        These features are under development. Keep them OFF until they are fully
        built, tested, and ready for production.
      </p>
      {flags.map((flag) => (
        <div
          key={flag.key}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{flag.label}</p>
            <p className="text-xs text-gray-500">{flag.description}</p>
          </div>
          <button
            onClick={() => handleToggle(flag.key, event[flag.key])}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
              event[flag.key] ? "bg-teal-500" : "bg-gray-200"
            } ${isPending ? "opacity-50" : ""}`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                event[flag.key] ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Handicap Sync Settings
// ============================================================

interface HandicapSyncStatus {
  status: "healthy" | "partial" | "failed" | "never";
  lastSyncAt: string | null;
  successCount: number;
  totalGolfers: number;
  failureCount: number;
  errorMessage: string | null;
}

export function HandicapSyncForm({
  event,
  syncStatus,
}: {
  event: any;
  syncStatus: HandicapSyncStatus | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleToggle = () => {
    startTransition(async () => {
      await updateHandicapSyncEnabled(event.id, !event.handicap_sync_enabled);
      router.refresh();
    });
  };

  const statusConfig = {
    healthy: { label: "Healthy", color: "bg-green-100 text-green-800", dot: "bg-green-500" },
    partial: { label: "Partial", color: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
    failed: { label: "Failed", color: "bg-red-100 text-red-800", dot: "bg-red-500" },
    never: { label: "Never Synced", color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  };

  const status = syncStatus?.status || "never";
  const config = statusConfig[status];

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Enable Handicap Sync</p>
          <p className="text-xs text-gray-500">
            Automatically fetch current USGA Handicap Index for all golfers with
            a GHIN number. Syncs within 24 hours of each scheduled game.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
            event.handicap_sync_enabled ? "bg-teal-500" : "bg-gray-200"
          } ${isPending ? "opacity-50" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
              event.handicap_sync_enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Status Indicator */}
      {event.handicap_sync_enabled && syncStatus && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${config.dot}`} />
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
          {syncStatus.lastSyncAt && (
            <p className="mt-1 text-xs text-gray-500">
              Last synced: {new Date(syncStatus.lastSyncAt).toLocaleString("en-US", {
                timeZone: "America/Los_Angeles",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })} PT
            </p>
          )}
          {status !== "never" && (
            <p className="mt-0.5 text-xs text-gray-500">
              {syncStatus.successCount} of {syncStatus.totalGolfers} golfers updated
              {syncStatus.failureCount > 0 && ` (${syncStatus.failureCount} failed)`}
            </p>
          )}
          {status === "failed" && syncStatus.errorMessage && (
            <p className="mt-1 text-xs text-red-600">
              Error: {syncStatus.errorMessage}
            </p>
          )}
        </div>
      )}

      {/* Info Note */}
      <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
        Requires GHIN credentials (GHIN_EMAIL and GHIN_PASSWORD) to be configured
        in the environment. Uses the unofficial GHIN API — if the USGA changes
        their API, the sync may stop working. You will receive an email alert if
        the sync fails.
      </p>
    </div>
  );
}

// ============================================================
// Join Link
// ============================================================

export function JoinLinkSection({ slug }: { slug: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!slug) {
    return (
      <p className="text-sm text-gray-500">
        No join link available. Set a URL slug in Basic Settings to enable a
        shareable join link for this event.
      </p>
    );
  }

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://frccgolfgames.com";
  const joinUrl = `${siteUrl}/join/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = joinUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-600">
        Share this link with golfers who want to join this event. They&apos;ll
        fill out their info and be placed in the pending approval queue.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={joinUrl}
          className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-700"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          onClick={handleCopy}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            copied
              ? "bg-teal-100 text-teal-700"
              : "bg-teal-600 text-white hover:bg-teal-500"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Danger Zone
// ============================================================

export function DangerZone({
  eventId,
  eventName,
  isActive,
}: {
  eventId: string;
  eventName: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  const handleToggleActive = () => {
    const action = isActive ? "deactivate" : "reactivate";
    if (
      confirm(
        `Are you sure you want to ${action} this event? ${isActive ? "All automated emails will stop." : "Automated emails will resume."}`
      )
    ) {
      startTransition(async () => {
        if (isActive) {
          await deactivateEvent(eventId);
        } else {
          await reactivateEvent(eventId);
        }
      });
    }
  };

  const handlePermanentDelete = () => {
    setDeleteError(null);
    startTransition(async () => {
      const result = await permanentlyDeleteEvent(eventId, deleteConfirmName);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        router.push("/admin");
      }
    });
  };

  const nameMatches = deleteConfirmName.trim().toLowerCase() === eventName.trim().toLowerCase();

  return (
    <div className="space-y-6">
      {/* Deactivate / Reactivate */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {isActive ? "Deactivate Event" : "Reactivate Event"}
          </p>
          <p className="text-xs text-gray-500">
            {isActive
              ? "Stops all automated emails and hides from golfer subscriptions. The event and all its data are preserved."
              : "Resumes automated emails and makes event visible again."}
          </p>
        </div>
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            isActive
              ? "border border-red-300 text-red-700 hover:bg-red-50"
              : "bg-teal-600 text-white hover:bg-teal-500"
          }`}
        >
          {isPending
            ? "..."
            : isActive
              ? "Deactivate"
              : "Reactivate"}
        </button>
      </div>

      {/* Divider */}
      <hr className="border-red-200" />

      {/* Permanently Delete */}
      <div>
        <p className="text-sm font-medium text-red-700">
          Permanently Delete Event
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          This will permanently delete the event and all associated data including
          schedules, RSVPs, email history, golfer subscriptions, preferences, and
          groupings. This action cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete Event...
          </button>
        ) : (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              Type the event name to confirm:
            </p>
            <p className="mt-1 text-xs font-mono text-red-600">
              {eventName}
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => {
                setDeleteConfirmName(e.target.value);
                setDeleteError(null);
              }}
              placeholder="Type event name here"
              className="mt-2 w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            {deleteError && (
              <p className="mt-2 text-xs text-red-700">{deleteError}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={handlePermanentDelete}
                disabled={isPending || !nameMatches}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Permanently Delete"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmName("");
                  setDeleteError(null);
                }}
                disabled={isPending}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
