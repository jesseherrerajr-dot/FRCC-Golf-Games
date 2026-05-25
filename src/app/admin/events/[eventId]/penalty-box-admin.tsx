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
  const [selectedGolfers, setSelectedGolfers] = useState<Set<string>>(new Set());
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
    "Co-conspirators in crimes against the group",
  ];

  const toggleGolfer = (id: string) => {
    setSelectedGolfers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedGolfers.size === 0 || !charge.trim()) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("eventId", eventId);
      formData.set("chargedBy", chargedBy);
      formData.set("charge", charge);
      formData.set("slug", slug);
      formData.set("eventName", eventName);
      // Send all selected profile IDs
      Array.from(selectedGolfers).forEach((id) => {
        formData.append("profileIds", id);
      });

      const result = await sendToPenaltyBox(formData);
      if (result.error) {
        setMessage({ text: result.error, isError: true });
      } else {
        const count = selectedGolfers.size;
        setMessage({
          text: count === 1
            ? "Golfer sent to the Penalty Box! Email notification sent."
            : `${count} golfers sent to the Penalty Box! Email notification sent.`,
          isError: false,
        });
        setShowForm(false);
        setSelectedGolfers(new Set());
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Golfer{selectedGolfers.size !== 1 ? "s" : ""}
          {selectedGolfers.size > 0 && (
            <span className="ml-2 text-red-600 font-normal">
              ({selectedGolfers.size} selected)
            </span>
          )}
        </label>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 divide-y divide-gray-100">
          {subscribers.map((s) => {
            const isSelected = selectedGolfers.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleGolfer(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                  isSelected
                    ? "bg-red-50 text-red-900"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className={`flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center ${
                  isSelected
                    ? "bg-red-600 border-red-600"
                    : "border-gray-300"
                }`}>
                  {isSelected && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                {formatFullName(s.first_name, s.last_name)}
              </button>
            );
          })}
        </div>
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
        disabled={selectedGolfers.size === 0 || !charge.trim() || isPending}
        className="w-full py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm"
      >
        {isPending
          ? "Sending..."
          : selectedGolfers.size > 1
            ? `🔒 Send ${selectedGolfers.size} Golfers to Penalty Box`
            : "🔒 Send to Penalty Box"
        }
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
