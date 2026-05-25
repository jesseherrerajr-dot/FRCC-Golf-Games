"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatFullName } from "@/lib/format";
import type { PenaltyRecordWithProfiles } from "@/types/events";
import {
  selectCharacterWitnesses,
  submitPenaltyApology,
} from "./actions";

// ============================================================
// Types
// ============================================================

interface SerializedPenalty extends PenaltyRecordWithProfiles {
  timeServed: string;
  yesVotes: number;
  noVotes: number;
  pendingWitnesses?: number;
}

interface PenaltyBoxClientProps {
  slug: string;
  eventId: string;
  eventName: string;
  adminName: string;
  currentUserId: string;
  activePenalties: SerializedPenalty[];
  penaltyHistory: SerializedPenalty[];
  userPenalty: (SerializedPenalty & { timeServed: string }) | null;
  eligibleWitnesses: Array<{ id: string; first_name: string; last_name: string }>;
}

// ============================================================
// Time Served Counter
// ============================================================

function TimeServedCounter({ startDate }: { startDate: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const start = new Date(startDate).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - start);

      const seconds = Math.floor(diff / 1000) % 60;
      const minutes = Math.floor(diff / (1000 * 60)) % 60;
      const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setElapsed(parts.join(" "));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  return <span className="font-mono text-red-600 font-bold">{elapsed}</span>;
}

// ============================================================
// Witness Selector
// ============================================================

function WitnessSelector({
  eligibleWitnesses,
  witnessesNeeded,
  onSelect,
}: {
  eligibleWitnesses: Array<{ id: string; first_name: string; last_name: string }>;
  witnessesNeeded: number;
  onSelect: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggleWitness = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < witnessesNeeded) {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size !== witnessesNeeded) return;
    setSubmitting(true);
    onSelect(Array.from(selected));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Select {witnessesNeeded} golfer{witnessesNeeded !== 1 ? "s" : ""} to serve as character witnesses.
        They&apos;ll play the mini golf challenge and vote on your release.
      </p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {eligibleWitnesses.map((w) => (
          <button
            key={w.id}
            onClick={() => toggleWitness(w.id)}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
              selected.has(w.id)
                ? "border-blue-500 bg-blue-50 text-blue-900"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <span className="font-medium">
              {formatFullName(w.first_name, w.last_name)}
            </span>
            {selected.has(w.id) && (
              <span className="float-right text-blue-500">✓</span>
            )}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500">
        {selected.size} of {witnessesNeeded} selected
      </p>
      <button
        onClick={handleSubmit}
        disabled={selected.size !== witnessesNeeded || submitting}
        className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: "#1e3a5f" }}
      >
        {submitting ? "Sending requests..." : "Request Character Witnesses"}
      </button>
    </div>
  );
}

// ============================================================
// Apology Form
// ============================================================

function ApologyForm({
  penaltyId,
  slug,
  adminName,
}: {
  penaltyId: string;
  slug: string;
  adminName: string;
}) {
  const [apology, setApology] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!apology.trim()) return;
    setSubmitting(true);
    await submitPenaltyApology(penaltyId, apology, slug);
    setSubmitted(true);
    setSubmitting(false);
    router.refresh();
  };

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <p className="text-green-800 font-semibold">
          Your apology has been sent to {adminName}.
        </p>
        <p className="text-green-600 text-sm mt-1">
          They&apos;ll decide whether to release you from the Penalty Box.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-800 font-semibold">
          Three character witnesses have voted to keep you in the Penalty Box.
        </p>
        <p className="text-red-600 text-sm mt-1">
          Your only remaining option is to appeal directly to {adminName}.
        </p>
      </div>
      <textarea
        value={apology}
        onChange={(e) => setApology(e.target.value)}
        placeholder={`Write your apology to ${adminName}...`}
        className="w-full p-3 border border-gray-300 rounded-lg h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <button
        onClick={handleSubmit}
        disabled={!apology.trim() || submitting}
        className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: "#1e3a5f" }}
      >
        {submitting ? "Sending..." : "Send Apology & Request Release"}
      </button>
    </div>
  );
}

// ============================================================
// Penalty Card Component
// ============================================================

function PenaltyCard({
  penalty,
  isCurrentUser,
}: {
  penalty: SerializedPenalty;
  isCurrentUser: boolean;
}) {
  const golferName = formatFullName(
    penalty.profile.first_name,
    penalty.profile.last_name
  );

  const statusLabel = {
    incarcerated: "Incarcerated",
    awaiting_witnesses: "Awaiting Witnesses",
    apology_required: "Apology Required",
    released: "Released",
  }[penalty.status];

  const statusColor = {
    incarcerated: "bg-red-100 text-red-800",
    awaiting_witnesses: "bg-amber-100 text-amber-800",
    apology_required: "bg-orange-100 text-orange-800",
    released: "bg-green-100 text-green-800",
  }[penalty.status];

  return (
    <div className={`rounded-lg border bg-white shadow-sm p-4 ${isCurrentUser ? "border-red-300 ring-2 ring-red-100" : "border-gray-200"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-gray-900">{golferName}</p>
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold mt-1 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Time Served</p>
          <TimeServedCounter startDate={penalty.created_at} />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">The Charge</p>
        <p className="text-sm text-gray-800 italic">&ldquo;{penalty.charge}&rdquo;</p>
      </div>

      {/* Witness progress */}
      {penalty.status !== "incarcerated" && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Witness Progress</span>
            <span className="font-semibold">
              {penalty.yesVotes} of {penalty.witnesses_required} votes for release
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (penalty.yesVotes / penalty.witnesses_required) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Witness testimonies */}
      {penalty.witnesses.filter((w) => w.status === "completed").length > 0 && (
        <div className="space-y-2 mt-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Testimonies</p>
          {penalty.witnesses
            .filter((w) => w.status === "completed")
            .map((w) => (
              <div key={w.id} className="bg-gray-50 rounded p-2 text-sm">
                <span className="font-semibold">
                  {formatFullName(w.witness_profile.first_name, w.witness_profile.last_name)}
                </span>
                <span className={`ml-2 text-xs font-bold ${w.vote === "yes" ? "text-green-600" : "text-red-600"}`}>
                  {w.vote === "yes" ? "✓ Release" : "✗ Keep Locked"}
                </span>
                {w.testimony && (
                  <p className="text-gray-600 italic mt-1">&ldquo;{w.testimony}&rdquo;</p>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Pending witnesses */}
      {penalty.witnesses.filter((w) => w.status === "pending").length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500">
            Waiting on: {penalty.witnesses
              .filter((w) => w.status === "pending")
              .map((w) => formatFullName(w.witness_profile.first_name, w.witness_profile.last_name))
              .join(", ")}
          </p>
        </div>
      )}

      {/* Apology display */}
      {penalty.apology_text && (
        <div className="bg-green-50 rounded-lg p-3 mt-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Apology Submitted</p>
          <p className="text-sm text-gray-800 italic">&ldquo;{penalty.apology_text}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Client Component
// ============================================================

export function PenaltyBoxClient({
  slug,
  eventId,
  eventName,
  adminName,
  currentUserId,
  activePenalties,
  penaltyHistory,
  userPenalty,
  eligibleWitnesses,
}: PenaltyBoxClientProps) {
  const router = useRouter();

  const handleWitnessSelect = async (ids: string[]) => {
    if (!userPenalty) return;
    await selectCharacterWitnesses(userPenalty.id, ids, slug);
    router.refresh();
  };

  // Calculate how many more witnesses the user needs to select
  const witnessesNeeded = userPenalty
    ? (() => {
        const yesVotes = userPenalty.witnesses.filter(
          (w) => w.status === "completed" && w.vote === "yes"
        ).length;
        const pendingVotes = userPenalty.witnesses.filter(
          (w) => w.status === "pending"
        ).length;
        const remaining = userPenalty.witnesses_required - yesVotes - pendingVotes;
        return Math.max(0, remaining);
      })()
    : 0;

  return (
    <div className="space-y-8">
      {/* User's own penalty status */}
      {userPenalty && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-red-900 mb-3">
            🔒 You&apos;re in the Penalty Box
          </h2>

          {userPenalty.status === "incarcerated" && (
            <div className="space-y-3">
              <p className="text-gray-700">
                Complete the 3-hole Escape Challenge to begin your release process.
              </p>
              <a
                href={`/penalty-box/${slug}/escape/${userPenalty.id}`}
                className="block w-full py-3 rounded-xl font-bold text-white text-center text-lg"
                style={{ backgroundColor: "#1e3a5f" }}
              >
                Begin Escape Challenge
              </a>
            </div>
          )}

          {userPenalty.status === "awaiting_witnesses" && witnessesNeeded > 0 && eligibleWitnesses.length > 0 && (
            <WitnessSelector
              eligibleWitnesses={eligibleWitnesses}
              witnessesNeeded={witnessesNeeded}
              onSelect={handleWitnessSelect}
            />
          )}

          {userPenalty.status === "awaiting_witnesses" && witnessesNeeded === 0 && (
            <p className="text-amber-700">
              Your witness requests are out. Waiting for responses...
            </p>
          )}

          {userPenalty.status === "apology_required" && !userPenalty.apology_text && (
            <ApologyForm
              penaltyId={userPenalty.id}
              slug={slug}
              adminName={adminName}
            />
          )}

          {userPenalty.status === "apology_required" && userPenalty.apology_text && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-800 font-semibold">
                Your apology has been submitted. Waiting for {adminName} to decide your fate.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Current Inmates */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Current Inmates
        </h2>
        {activePenalties.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-green-800 text-lg">🎉 The Penalty Box is empty!</p>
            <p className="text-green-600 text-sm mt-1">
              Everyone is on their best behavior... for now.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activePenalties.map((p) => (
              <PenaltyCard
                key={p.id}
                penalty={p}
                isCurrentUser={p.profile_id === currentUserId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Penalty History */}
      {penaltyHistory.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Penalty History
          </h2>
          <div className="space-y-4">
            {penaltyHistory.map((p) => {
              const golferName = formatFullName(
                p.profile.first_name,
                p.profile.last_name
              );
              const yesWitnesses = p.witnesses.filter(
                (w) => w.status === "completed" && w.vote === "yes"
              );

              return (
                <div key={p.id} className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-gray-900">{golferName}</p>
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-800">
                        Released
                      </span>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-500">Time served</p>
                      <p className="font-mono font-semibold text-gray-800">{p.timeServed}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 italic mb-2">
                    &ldquo;{p.charge}&rdquo;
                  </p>
                  {p.released_by_profile && (
                    <p className="text-xs text-gray-500">
                      Released by {formatFullName(p.released_by_profile.first_name, p.released_by_profile.last_name)} (admin release)
                    </p>
                  )}
                  {yesWitnesses.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {yesWitnesses.map((w) => (
                        <p key={w.id} className="text-xs text-gray-500">
                          <span className="font-semibold">
                            {formatFullName(w.witness_profile.first_name, w.witness_profile.last_name)}
                          </span>
                          : &ldquo;{w.testimony}&rdquo;
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
