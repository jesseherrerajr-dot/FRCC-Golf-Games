"use client";

import { useState } from "react";
import PuttingGame from "@/components/putting-game";
import { castWitnessVote } from "../../actions";

interface WitnessFlowClientProps {
  slug: string;
  witnessId: string;
  golferName: string;
  charge: string;
  adminName: string;
  clownTaunt: string;
  eventName: string;
}

type FlowPhase = "intro" | "game" | "vote" | "submitted";

export function WitnessFlowClient({
  slug,
  witnessId,
  golferName,
  charge,
  adminName,
  clownTaunt,
  eventName,
}: WitnessFlowClientProps) {
  const [phase, setPhase] = useState<FlowPhase>("intro");
  const [vote, setVote] = useState<"yes" | "no" | null>(null);
  const [testimony, setTestimony] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ triggered: string | null } | null>(null);

  const handleGameComplete = () => {
    setPhase("vote");
  };

  const handleVoteSubmit = async () => {
    if (!vote || !testimony.trim()) return;
    setSubmitting(true);
    const response = await castWitnessVote(witnessId, vote, testimony, slug);
    setResult(response as { triggered: string | null });
    setPhase("submitted");
    setSubmitting(false);
  };

  // ---- Intro Screen ----
  if (phase === "intro") {
    return (
      <div className="max-w-md space-y-6 text-center">
        <div className="text-5xl">🏛️</div>
        <h1 className="text-2xl font-bold text-gray-900">
          Character Witness Hearing
        </h1>
        <p className="text-gray-600">
          {eventName}
        </p>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">The Accused</p>
          <p className="font-bold text-gray-900 text-lg">{golferName}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-3 mb-1">The Charge</p>
          <p className="text-gray-800 italic">&ldquo;{charge}&rdquo;</p>
        </div>

        <p className="text-gray-600 text-sm">
          Before casting your vote, you must complete a 3-hole mini golf challenge.
          Then you&apos;ll decide whether {golferName} deserves release from the Penalty Box.
        </p>

        <button
          onClick={() => setPhase("game")}
          className="w-full py-4 rounded-xl font-bold text-white text-lg"
          style={{ backgroundColor: "#1e3a5f" }}
        >
          Begin Witness Testimony
        </button>
      </div>
    );
  }

  // ---- Game ----
  if (phase === "game") {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            🏛️ Witness Challenge
          </h1>
          <p className="text-sm text-gray-500">
            Complete the challenge, then cast your vote
          </p>
        </div>
        <PuttingGame
          charge={charge}
          adminName={adminName}
          clownTaunt={clownTaunt}
          witnessesRequired={0}
          onComplete={() => {}}
          isWitnessMode
          onWitnessComplete={handleGameComplete}
        />
      </div>
    );
  }

  // ---- Vote ----
  if (phase === "vote") {
    return (
      <div className="max-w-md space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-2">🗳️</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Cast Your Vote
          </h1>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">
            <strong>{golferName}</strong> was penalized for:
          </p>
          <p className="text-gray-800 italic mt-1">&ldquo;{charge}&rdquo;</p>
          <p className="text-sm text-gray-600 mt-3">
            Do you believe they deserve release from the Penalty Box?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setVote("yes")}
            className={`py-4 rounded-xl font-bold text-lg transition-all border-2 ${
              vote === "yes"
                ? "bg-green-100 border-green-500 text-green-800"
                : "bg-white border-gray-200 text-gray-700 hover:border-green-300"
            }`}
          >
            ✓ Release Them
          </button>
          <button
            onClick={() => setVote("no")}
            className={`py-4 rounded-xl font-bold text-lg transition-all border-2 ${
              vote === "no"
                ? "bg-red-100 border-red-500 text-red-800"
                : "bg-white border-gray-200 text-gray-700 hover:border-red-300"
            }`}
          >
            ✗ Keep Locked
          </button>
        </div>

        {vote && (
          <div className="space-y-3 animate-fade-in">
            <label className="block text-sm font-medium text-gray-700">
              {vote === "yes"
                ? `Why does ${golferName} deserve release?`
                : `Why should ${golferName} stay in the Penalty Box?`}
              <span className="text-red-500"> *</span>
            </label>
            <textarea
              value={testimony}
              onChange={(e) => setTestimony(e.target.value)}
              placeholder={
                vote === "yes"
                  ? `e.g., "I vouch for ${golferName} because they promised to stop texting the admin after 9pm."`
                  : `e.g., "I voted to keep ${golferName} locked up because they still haven't learned their lesson."`
              }
              className="w-full p-3 border border-gray-300 rounded-lg h-28 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleVoteSubmit}
              disabled={!testimony.trim() || submitting}
              className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              {submitting ? "Submitting..." : "Submit Your Testimony"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- Submitted ----
  return (
    <div className="max-w-md text-center space-y-4">
      <div className="text-5xl">
        {vote === "yes" ? "🎉" : "⚖️"}
      </div>
      <h1 className="text-2xl font-bold text-gray-900">
        Testimony Recorded
      </h1>
      <p className="text-gray-600">
        {vote === "yes"
          ? `You voted to release ${golferName} from the Penalty Box. Your testimony has been recorded.`
          : `You voted to keep ${golferName} in the Penalty Box. They'll need to find a replacement witness.`}
      </p>
      {result?.triggered === "released" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-800 font-semibold">
            🎉 {golferName} has been released from the Penalty Box!
          </p>
        </div>
      )}
      <a
        href={`/penalty-box/${slug}`}
        className="inline-block px-6 py-3 rounded-xl font-bold text-white"
        style={{ backgroundColor: "#1e3a5f" }}
      >
        View the Penalty Box
      </a>
    </div>
  );
}
