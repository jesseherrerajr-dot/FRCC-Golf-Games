"use client";

import { useState, useTransition } from "react";
import {
  sendTargetedEmail,
  sendProfileCompletionEmail,
  sendTestEmail,
  type EmailTarget,
  type EmailTemplate,
  type ProfileField,
} from "./actions";
import { formatGameDate, formatGameDateShort } from "@/lib/format";

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
    key: "extra_spots",
    label: "Extra Spots Available",
    subject: "[EVENT] - Extra Spots Available for [DATE]!",
    body: "Good news! We still have spots open for [DATE].\n\nIf you haven't RSVP'd yet or were on the fence, now is the time to jump in!\n\nPlease update your RSVP at frccgolfgames.com",
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
    key: "complete_profile",
    label: "Complete Your Profile",
    subject: "Action Required: Complete Your FRCC Golf Games Profile",
    body: "Hi [FIRST_NAME],\n\nYour FRCC Golf Games profile isn't complete. Please take 30 seconds to fill in the missing information (e.g. phone number, GHIN, playing partner preferences) to assist the event administrator.\n\nThank you!",
  },
  {
    key: "custom",
    label: "Custom Message",
    subject: "",
    body: "",
  },
];

const PROFILE_FIELDS: {
  key: ProfileField;
  label: string;
  description: string;
}[] = [
  {
    key: "phone",
    label: "Phone Number",
    description: "Golfers missing a phone number",
  },
  {
    key: "ghin",
    label: "GHIN Number",
    description: "Golfers missing a GHIN number",
  },
  {
    key: "playing_partners",
    label: "Playing Partner Preferences",
    description: "Golfers with no partner preferences set for this event",
  },
];

const TARGET_OPTIONS: {
  key: EmailTarget;
  label: string;
  description: string;
}[] = [
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
  const [profileFields, setProfileFields] = useState<ProfileField[]>([
    "phone",
    "ghin",
    "playing_partners",
  ]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    error?: string;
    email?: string;
  } | null>(null);
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    recipientCount?: number;
  } | null>(null);

  const isProfileMode = template === "complete_profile";
  const selectedDate = schedules.find((s) => s.id === selectedSchedule)?.gameDate;
  const formattedDate = selectedDate ? formatGameDate(selectedDate) : "";

  const applyTemplate = (templateKey: EmailTemplate) => {
    setTemplate(templateKey);
    setResult(null);
    const tmpl = TEMPLATES.find((t) => t.key === templateKey);
    if (!tmpl || templateKey === "custom") return;

    setSubject(
      tmpl.subject
        .replace("[EVENT]", eventName)
        .replace("[DATE]", formattedDate)
    );
    setBody(
      tmpl.body
        .replace(/\[DATE\]/g, formattedDate)
        .replace("[EVENT]", eventName)
    );
  };

  const toggleProfileField = (field: ProfileField) => {
    setProfileFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleSendTest = async () => {
    if (!subject.trim() || !body.trim()) return;
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTestEmail(eventId, template, subject, body);
      setTestResult(res);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) return;
    setTestResult(null);

    if (isProfileMode) {
      if (profileFields.length === 0) return;
      startTransition(async () => {
        const res = await sendProfileCompletionEmail(
          eventId,
          profileFields,
          subject,
          body
        );
        setResult(res);
      });
    } else {
      if (!selectedSchedule) return;
      startTransition(async () => {
        const res = await sendTargetedEmail(
          eventId,
          selectedSchedule,
          target,
          subject,
          body
        );
        setResult(res);
      });
    }
  };

  const canSend =
    !isPending &&
    !!subject.trim() &&
    !!body.trim() &&
    (isProfileMode ? profileFields.length > 0 : !!selectedSchedule);

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

      {/* Step 1: Choose Template */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700">
          1. Choose Template
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

      {/* Step 2a: Game Week (standard templates) */}
      {!isProfileMode && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700">
            2. Select Game Week
          </label>
          {schedules.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No upcoming games scheduled. Generate schedules first before
              sending emails.
            </p>
          ) : (
            <select
              value={selectedSchedule}
              onChange={(e) => setSelectedSchedule(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            >
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatGameDateShort(s.gameDate)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Step 2b: Profile Fields (complete_profile template) */}
      {isProfileMode && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700">
            2. Profile Fields to Check
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Active subscribers missing any checked field will receive this
            email.
          </p>
          <div className="mt-3 space-y-2">
            {PROFILE_FIELDS.map((field) => (
              <label
                key={field.key}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                  profileFields.includes(field.key)
                    ? "border-teal-500 bg-white"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={profileFields.includes(field.key)}
                  onChange={() => toggleProfileField(field.key)}
                  className="text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {field.label}
                  </p>
                  <p className="text-xs text-gray-500">{field.description}</p>
                </div>
              </label>
            ))}
          </div>
          {profileFields.length === 0 && (
            <p className="mt-2 text-xs text-red-500">
              Select at least one field.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Target Audience (standard templates only) */}
      {!isProfileMode && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700">
            3. Target Audience
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
      )}

      {/* Step 3/4: Compose */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700">
          {isProfileMode ? "3" : "4"}. Compose Message
        </label>
        {isProfileMode && (
          <p className="mt-1 text-xs text-gray-500">
            Use{" "}
            <code className="rounded bg-gray-100 px-1 font-mono">
              [FIRST_NAME]
            </code>{" "}
            to personalize each email with the golfer&apos;s name.
          </p>
        )}

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

      {/* Test Result */}
      {testResult?.success && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-700">
            Test email sent to {testResult.email}. Check your inbox!
          </p>
        </div>
      )}
      {testResult?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{testResult.error}</p>
        </div>
      )}

      {/* Send Test + Send */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSendTest}
          disabled={!subject.trim() || !body.trim() || isSendingTest || isPending}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {isSendingTest ? "Sending..." : "Send Test to Me"}
        </button>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send Email"}
        </button>
      </div>
    </div>
  );
}
