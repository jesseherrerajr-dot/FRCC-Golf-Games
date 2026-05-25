"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatFullName } from "@/lib/format";
import { sendToPenaltyBox, adminRelease } from "@/app/penalty-box/[slug]/actions";
import type { PenaltyRecordWithProfiles } from "@/types/events";

// ============================================================
// Send to Penalty Box Form
// ============================================================

export function SendToPenaltyBoxForm({
  eventId,
  eventName,
  slug,
  chargedBy,
  subscribers,
}: {
  eventId: string;
  eventName: string;
  slug: string;
  chargedBy: string;
  subscribers: Array<{ id: string; first_name: string; last_name: string }>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedGolfer, setSelectedGolfer] = useState("");
  const [charge, setCharge] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const router = useRouter();

  const presetCharges = [
    "Excessive pairing requests",
    "Late-night admin harassment",
    "Unsolicited swing advice",
    "Slow play advocacy",
    "Complained about the weather forecast",
    "Asked 'what time do we tee off?' for the 5th time",
  ];

  const handleSubmit = () => {
    if (!selectedGolfer || !charge.trim()) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("eventId", eventId);
      formData.set("profileId", selectedGolfer);
      formData.set("chargedBy", chargedBy);
      formData.set("charge", charge);
      formData.set("slug", slug);
      formData.set("eventName", eventName);

      const result = await sendToPenaltyBox(formData);
      if (result.error) {
        setMessage({ text: result.error, isError: true });
      } else {
        setMessage({ text: "Golfer sent to the Penalty Box! Email notification sent.", isError: false });
        setShowForm(false);
        setSelectedGolfer("");
        setCharge("");
        router.refresh();
      }
    });
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
      >
        🔒 Send to Penalty Box
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-red-900">Send to Penalty Box</h3>
        <button
          onClick={() => { setShowForm(false); setMessage(null); }}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          Cancel
        </button>
      </div>

      {message && (
        <p className={`rounded-md p-2 text-xs ${message.isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message.text}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Golfer</label>
        <select
          value={selectedGolfer}
          onChange={(e) => setSelectedGolfer(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
        >
          <option value="">Choose a golfer...</option>
          {subscribers.map((s) => (
            <option key={s.id} value={s.id}>
              {formatFullName(s.first_name, s.last_name)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">The Charge</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {presetCharges.map((preset) => (
            <button
              key={preset}
              onClick={() => setCharge(preset)}
              className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
            >
              {preset}
            </button>
          ))}
        </div>
        <textarea
          value={charge}
          onChange={(e) => setCharge(e.target.value)}
          placeholder="Write the charge... be creative!"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm h-20 resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selectedGolfer || !charge.trim() || isPending}
        className="w-full py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm"
      >
        {isPending ? "Sending..." : "🔒 Send to Penalty Box"}
      </button>
    </div>
  );
}

// ============================================================
// Active Penalties Admin View
// ============================================================

export function ActivePenaltiesAdmin({
  penalties,
  slug,
  currentUserId,
}: {
  penalties: Array<PenaltyRecordWithProfiles & { timeServed: string }>;
  slug: string;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (penalties.length === 0) return null;

  const handleRelease = (penaltyId: string) => {
    startTransition(async () => {
      await adminRelease(penaltyId, currentUserId, slug);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Active Penalties</h3>
      {penalties.map((p) => {
        const golferName = formatFullName(p.profile.first_name, p.profile.last_name);
        const yesVotes = p.witnesses.filter((w) => w.status === "completed" && w.vote === "yes").length;

        return (
          <div key={p.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-gray-900">{golferName}</span>
              <span className="text-xs font-mono text-red-600">{p.timeServed}</span>
            </div>
            <p className="text-xs text-gray-600 italic mb-2">&ldquo;{p.charge}&rdquo;</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {yesVotes}/{p.witnesses_required} witnesses • {p.status.replace("_", " ")}
              </span>
              <button
                onClick={() => handleRelease(p.id)}
                disabled={isPending}
                className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold hover:bg-green-200 disabled:opacity-50"
              >
                Release
              </button>
            </div>
            {p.apology_text && (
              <div className="mt-2 bg-white rounded p-2 border border-green-200">
                <p className="text-xs text-gray-500">Apology submitted:</p>
                <p className="text-xs text-gray-700 italic">&ldquo;{p.apology_text}&rdquo;</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
