"use client";

import { useState, useTransition } from "react";
import {
  sendTargetedEmail,
  type EmailTarget,
  type EmailTemplate,
} from "./actions";

interface Schedule {
  id: string;
  gameDate: string;
}

const TEMPLATES: {
  key: EmailTemplate;
  label: string;
  subject: string;
  body: string;
}[] = [
  {
    key: "game_cancelled",
    label: "Game Cancelled",
    subject: "[EVENT] for [DATE] has been cancelled",
    body: "Unfortunately, the game scheduled for [DATE] has been cancelled due to [reason].\n\nThe next scheduled game is [NEXT DATE].\n\nWe apologize for the inconvenience.",
  },
  {
    key: "extra_spots",
    label: "Extra Spots Available",
    subject: "[EVENT] - Extra Spots Available for [DATE]!",
    body: "Good news! We still have spots open for [DATE].\n\nIf you haven't RSVP'd yet or were on the fence, now is the time to jump in!\n\nPlease update your RSVP on the dashboard.",
  },
  {
    key: "weather_advisory",
    label: "Weather Advisory",
    subject: "[EVENT] - Weather Update for [DATE]",
    body: "Weather update for [DATE]:\n\n[Weather details here]\n\nThe game is still ON. Please dress accordingly and check back for any updates.",
  },
  {
    key: "course_update",
    label: "Course Update",
    subject: "[EVENT] - Course Update for [DATE]",
    body: "Quick update regarding course conditions for [DATE]:\n\n[Course details here]\n\nSee you on the course!",
  },
  {
    key: "custom",
    label: "Custom Message",
    subject: "",
    body: "",
  },
];

const TARGET_OPTIONS: { key: EmailTarget; label: string; description: string }[] = [
  {
    key: "in",
    label: "Confirmed (In)",
    description: "Players who RSVP'd 'In'",
  },
  {
    key: "not_sure_no_response",
    label: "Not Sure + No Response",
    description: "Players who haven't committed",
  },
  {
    key: "out",
    label: "Out",
    description: "Players who declined",
  },
  {
    key: "waitlisted",
    label: "Waitlisted",
    description: "Players on the waitlist",
  },
  {
    key: "everyone",
    label: "Everyone",
    description: "All players regardless of RSVP status",
  },
];

export function EmailComposerForm({
  eventId,
  eventName,
  schedules,
}: {
  eventId: string;
  eventName: string;
  schedules: Schedule[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedSchedule, setSelectedSchedule] = useState(
    schedules[0]?.id || ""
  );
  const [target, setTarget] = useState<EmailTarget>("everyone");
  const [template, setTemplate] = useState<EmailTemplate>("custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    recipientCount?: number;
  } | null>(null);

  const selectedDate = schedules.find((s) => s.id === selectedSchedule)?.gameDate;
  const formattedDate = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  const applyTemplate = (templateKey: EmailTemplate) => {
    setTemplate(templateKey);
    const tmpl = TEMPLATES.find((t) => t.key === templateKey);
    if (!tmpl || templateKey === "custom") return;

    // Replace placeholders
    const nextDate = schedules.length > 1 ? schedules[1]?.gameDate : "TBD";
    const nextFormatted = nextDate && nextDate !== "TBD"
      ? new Date(nextDate + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : "TBD";

    setSubject(
      tmpl.subject
        .replace("[EVENT]", eventName)
        .replace("[DATE]", formattedDate)
    );
    setBody(
      tmpl.body
        .replace(/\[DATE\]/g, formattedDate)
        .replace("[NEXT DATE]", nextFormatted)
        .replace("[EVENT]", eventName)
    );
  };

  const handleSend = () => {
    if (!selectedSchedule || !subject.trim() || !body.trim()) return;

    startTransition(async () => {
      const res = await sendTargetedEmail(
        eventId,
        selectedSchedule,
        target,
        subject,
        body
      );
      setResult(res);
      if (res.success) {
        setShowPreview(false);
      }
    });
  };

  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-gray-500">
          No upcoming games scheduled. Generate schedules first before sending
          emails.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error */}
      {result?.success && (
        <div className="rounded-lg border border-teal-200 bg-navy-50 p-4">
          <p className="text-sm font-medium text-teal-600">
            Email sent to {result.recipientCount} recipient
            {result.recipientCount !== 1 ? "s" : ""}!
          </p>
        </div>
      )}
      {result?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{result.error}</p>
        </div>
      )}

      {/* Step 1: Select Week */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700">
          1. Select Game Week
        </label>
        <select
          value={selectedSchedule}
          onChange={(e) => setSelectedSchedule(e.target.value)}
          className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        >
          {schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {new Date(s.gameDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </option>
          ))}
        </select>
      </div>

      {/* Step 2: Target Audience */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700">
          2. Target Audience
        </label>
        <div className="mt-3 space-y-2">
          {TARGET_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                target === opt.key
                  ? "border-teal-500 bg-navy-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="target"
                value={opt.key}
                checked={target === opt.key}
                onChange={() => setTarget(opt.key)}
                className="text-teal-600 focus:ring-teal-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Step 3: Template */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700">
          3. Choose Template (optional)
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.key}
              onClick={() => applyTemplate(tmpl.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                template === tmpl.key
                  ? "bg-teal-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tmpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 4: Compose */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700">
          4. Compose Message
        </label>

        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line..."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Type your message here..."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Preview + Send */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowPreview(!showPreview)}
          disabled={!subject.trim() || !body.trim()}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {showPreview ? "Hide Preview" : "Preview"}
        </button>

        <button
          onClick={handleSend}
          disabled={
            isPending || !selectedSchedule || !subject.trim() || !body.trim()
          }
          className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send Email"}
        </button>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-6">
          <p className="mb-2 text-xs font-medium uppercase text-gray-400">
            Email Preview
          </p>
          <div className="rounded bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              <strong>To:</strong>{" "}
              {TARGET_OPTIONS.find((t) => t.key === target)?.label} for{" "}
              {formattedDate}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              <strong>Subject:</strong> {subject}
            </p>
            <hr className="my-3" />
            <div
              className="prose prose-sm text-gray-700"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {body}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
