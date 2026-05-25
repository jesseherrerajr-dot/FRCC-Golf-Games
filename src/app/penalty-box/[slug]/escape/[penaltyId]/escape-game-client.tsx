"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PuttingGame from "@/components/putting-game";
import { completeEscapeGame } from "../../actions";

interface EscapeGameClientProps {
  slug: string;
  penaltyId: string;
  charge: string;
  adminName: string;
  clownTaunt: string;
  witnessesRequired: number;
}

export function EscapeGameClient({
  slug,
  penaltyId,
  charge,
  adminName,
  clownTaunt,
  witnessesRequired,
}: EscapeGameClientProps) {
  const [gameComplete, setGameComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleGameComplete = async () => {
    setGameComplete(true);
    setSaving(true);
    await completeEscapeGame(penaltyId, slug);
    setSaving(false);
    // Redirect to penalty box page to select witnesses
    router.push(`/penalty-box/${slug}`);
  };

  if (gameComplete && saving) {
    return (
      <div className="text-center">
        <p className="text-lg text-gray-600 animate-pulse">
          Saving your escape progress...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          🔒 Escape Challenge
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Complete 3 holes to begin your escape
        </p>
      </div>

      <PuttingGame
        charge={charge}
        adminName={adminName}
        clownTaunt={clownTaunt}
        witnessesRequired={witnessesRequired}
        onComplete={handleGameComplete}
      />
    </div>
  );
}
