"use client";

import { useTransition, useState } from "react";
import {
  updateEventBasicSettings,
  updateEmailScheduleSettings,
  updateAlertSetting,
  addProShopContact,
  removeProShopContact,
  assignEventAdmin,
  removeEventAdmin,
  updateFeatureFlags,
  deactivateEvent,
  reactivateEvent,
} from "./actions";
import type { AlertType } from "@/types/events";

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
//
// Dropdown → Cron (PST) → UTC
//   7:45 AM →  8:00 AM  → 0 16 * * *
//   8:45 AM →  9:00 AM  → 0 17 * * *
//   9:45 AM → 10:00 AM  → 0 18 * * *
//  10:45 AM → 11:00 AM  → 0 19 * * *
//  11:45 AM → 12:00 PM  → 0 20 * * *
//   4:45 PM →  5:00 PM  → 0  1 * * *
//
// Note: During PDT (Mar–Nov), crons fire 1 hour later in Pacific Time.
// The 3-hour send window in isWithinSendWindow() still catches every slot.
const TIME_OPTIONS = [
  { value: "07:45", label: "7:45 AM" },
  { value: "08:45", label: "8:45 AM" },
  { value: "09:45", label: "9:45 AM" },
  { value: "10:45", label: "10:45 AM" },
  { value: "11:45", label: "11:45 AM" },
  { value: "16:45", label: "4:45 PM" },
];

/**
 * Snap a time string (HH:MM) to the nearest :45 option.
 * Used to migrate existing free-form times to the constrained dropdown.
 */
function snapToNearest45(time: string | undefined | null): string {
  if (!time) return "09:45"; // default
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

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateEventBasicSettings(event.id, formData);
      setMessage(result.error || "Settings saved successfully.");
      if (!result.error) setTimeout(() => setMessage(null), 3000);
    });
  };

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

export function EmailScheduleForm({ event }: { event: any }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [numReminders, setNumReminders] = useState(event.num_reminders || 1);
  // A counter that increments on successful save, used as a React key
  // to force DayTimeRow components to remount with fresh values from the DB.
  const [saveCount, setSaveCount] = useState(0);

  const handleSubmit = (formData: FormData) => {
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
          <option value="0">0</option>
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

      {/* Cutoff */}
      <DayTimeRow
        label="RSVP Cutoff"
        dayName="cutoff_day"
        timeName="cutoff_time"
        dayDefault={event.cutoff_day}
        timeDefault={event.cutoff_time?.slice(0, 5)}
      />
      <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        A golfer confirmation email will be sent automatically 30 minutes after the cutoff time.
        Pro shop contacts are CC&apos;d on this email for early visibility.
      </p>

      {/* Pro Shop Detail Email */}
      <DayTimeRow
        label="Send Pro Shop Detail Email"
        dayName="confirmation_day"
        timeName="confirmation_time"
        dayDefault={event.confirmation_day}
        timeDefault={event.confirmation_time?.slice(0, 5)}
      />

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
// Pro Shop Contacts Form
// ============================================================

export function ProShopContactsForm({
  eventId,
  contacts,
}: {
  eventId: string;
  contacts: any[];
}) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addProShopContact(eventId, email, name || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        setEmail("");
        setName("");
      }
    });
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <p className="text-sm text-gray-500">No pro shop contacts added.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((contact: any) => (
            <ProShopContactRow
              key={contact.id}
              contact={contact}
              eventId={eventId}
            />
          ))}
        </ul>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contact name (optional)"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto sm:flex-1"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="proshop@example.com"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto sm:flex-1"
        />
        <button
          onClick={handleAdd}
          disabled={isPending || !email.trim()}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {isPending ? "..." : "Add"}
        </button>
      </div>
    </div>
  );
}

function ProShopContactRow({
  contact,
  eventId,
}: {
  contact: any;
  eventId: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    if (confirm(`Remove ${contact.email}?`)) {
      startTransition(async () => {
        await removeProShopContact(contact.id, eventId);
      });
    }
  };

  return (
    <li className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <div>
        {contact.name && (
          <span className="text-sm font-medium text-gray-900">{contact.name} — </span>
        )}
        <span className="text-sm text-gray-700">{contact.email}</span>
      </div>
      <button
        onClick={handleRemove}
        disabled={isPending}
        className="ml-2 text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {isPending ? "..." : "Remove"}
      </button>
    </li>
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

export function FeatureFlagsForm({ event }: { event: any }) {
  const [isPending, startTransition] = useTransition();

  const flags = [
    {
      key: "allow_guest_requests",
      label: "Guest Requests",
      description: "Allow members to request to bring guests",
    },
    {
      key: "allow_tee_time_preferences",
      label: "Tee Time Preferences",
      description: "Allow golfers to indicate early/late preference",
    },
    {
      key: "allow_playing_partner_preferences",
      label: "Playing Partner Preferences",
      description: "Allow golfers to select preferred playing partners",
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
  isActive,
}: {
  eventId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const handleAction = () => {
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

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">
          {isActive ? "Deactivate Event" : "Reactivate Event"}
        </p>
        <p className="text-xs text-gray-500">
          {isActive
            ? "Stops all automated emails and hides from golfer subscriptions."
            : "Resumes automated emails and makes event visible again."}
        </p>
      </div>
      <button
        onClick={handleAction}
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
  );
}
