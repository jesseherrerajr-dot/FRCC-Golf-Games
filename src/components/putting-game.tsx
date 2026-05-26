"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// Types
// ============================================================

type HoleNumber = 1 | 2 | 3;
type GamePhase = "intro" | "playing" | "success" | "miss" | "clown-reveal" | "complete";

interface HoleConfig {
  number: HoleNumber;
  name: string;
  subtitle: string;
  sweetSpotPercent: number; // % of meter that is the sweet spot
  greenColor: string;
  description: string;
}

interface PuttingGameProps {
  /** The charge text (displayed on hole 2 subtitle) */
  charge: string;
  /** The event admin name (used for the clown) */
  adminName: string;
  /** The clown taunt message */
  clownTaunt: string;
  /** Number of witnesses required */
  witnessesRequired: number;
  /** Called when the game is complete (after clown reveal acknowledged) */
  onComplete: () => void;
  /** Whether this is the witness version (clown asks for vote instead of witnesses) */
  isWitnessMode?: boolean;
  /** Called when witness finishes (witness mode only) */
  onWitnessComplete?: () => void;
  /** Optional image URL for the admin gatekeeper (replaces clown emoji) */
  adminImageUrl?: string;
}

// ============================================================
// Hole Configurations
// ============================================================

function getHoles(charge: string): HoleConfig[] {
  return [
    {
      number: 1,
      name: "Hole 1",
      subtitle: "Even you can make this one.",
      sweetSpotPercent: 40,
      greenColor: "#22c55e",
      description: "A short, straight putt. Easy money.",
    },
    {
      number: 2,
      name: "Hole 2",
      subtitle: `Difficulty adjusted for: "${charge.length > 60 ? charge.slice(0, 57) + "..." : charge}"`,
      sweetSpotPercent: 20,
      greenColor: "#eab308",
      description: "A tricky putt with a curve. Time it right.",
    },
    {
      number: 3,
      name: "Hole 3",
      subtitle: "The final challenge...",
      sweetSpotPercent: 25,
      greenColor: "#ef4444",
      description: "Sink it in the gatekeeper's mouth to escape!",
    },
  ];
}

// ============================================================
// Power Meter Component
// ============================================================

function PowerMeter({
  sweetSpotPercent,
  onResult,
  disabled,
}: {
  sweetSpotPercent: number;
  onResult: (hit: boolean) => void;
  disabled: boolean;
}) {
  const [meterPosition, setMeterPosition] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [result, setResult] = useState<"hit" | "miss" | null>(null);
  const animationRef = useRef<number | null>(null);
  const directionRef = useRef(1);

  // Calculate sweet spot position (centered in the meter)
  const sweetSpotStart = (100 - sweetSpotPercent) / 2;
  const sweetSpotEnd = sweetSpotStart + sweetSpotPercent;

  const animate = useCallback(() => {
    setMeterPosition((prev) => {
      let next = prev + directionRef.current * 1.8;
      if (next >= 100) {
        next = 100;
        directionRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        directionRef.current = 1;
      }
      return next;
    });
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isRunning && !disabled) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRunning, disabled, animate]);

  const handleTap = () => {
    if (!isRunning || disabled) return;
    setIsRunning(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const hit = meterPosition >= sweetSpotStart && meterPosition <= sweetSpotEnd;
    setResult(hit ? "hit" : "miss");

    // Delay before reporting result
    setTimeout(() => {
      onResult(hit);
      // Reset for potential retry
      setResult(null);
      setMeterPosition(0);
      directionRef.current = 1;
      setIsRunning(true);
    }, 800);
  };

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Meter bar */}
      <div className="relative h-10 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-300 mb-4">
        {/* Sweet spot zone */}
        <div
          className="absolute top-0 bottom-0 bg-green-200 border-x-2 border-green-400"
          style={{
            left: `${sweetSpotStart}%`,
            width: `${sweetSpotPercent}%`,
          }}
        />
        {/* Moving indicator */}
        <div
          className={`absolute top-0 bottom-0 w-1.5 transition-none ${
            result === "hit"
              ? "bg-green-500"
              : result === "miss"
              ? "bg-red-500"
              : "bg-gray-800"
          }`}
          style={{ left: `${meterPosition}%` }}
        />
      </div>

      {/* Tap button */}
      <button
        onClick={handleTap}
        disabled={!isRunning || disabled}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
          result === "hit"
            ? "bg-green-500 text-white"
            : result === "miss"
            ? "bg-red-500 text-white"
            : "bg-navy-800 text-white active:scale-95 hover:bg-navy-700"
        } disabled:opacity-50`}
        style={
          !result
            ? { backgroundColor: "#1e3a5f" }
            : undefined
        }
      >
        {result === "hit" ? "🎯 In the hole!" : result === "miss" ? "💨 Missed!" : "TAP TO PUTT"}
      </button>
    </div>
  );
}

// ============================================================
// Ball Animation Component
// ============================================================

function BallAnimation({
  result,
  holeNumber,
  adminImageUrl,
}: {
  result: "rolling" | "in" | "miss" | "clown-spit";
  holeNumber: HoleNumber;
  adminImageUrl?: string;
}) {
  return (
    <div className="relative w-full h-32 flex items-center justify-center">
      {/* The green */}
      <div className="absolute inset-0 bg-green-600 rounded-xl" style={{ backgroundColor: "#2d6a2d" }}>
        {/* Hole / Clown mouth */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2">
          {holeNumber === 3 ? (
            adminImageUrl ? (
              <div className={`relative transition-transform duration-300 ${result === "clown-spit" ? "scale-110" : ""}`}>
                <img
                  src={adminImageUrl}
                  alt="The Gatekeeper"
                  className="w-16 h-16 rounded-full border-2 border-red-500 object-cover"
                />
                {result === "clown-spit" && (
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 text-xl">💨</span>
                )}
              </div>
            ) : (
              <div className="text-4xl">
                {result === "clown-spit" ? "🤡💨" : "🤡"}
              </div>
            )
          ) : (
            <div
              className="w-6 h-6 rounded-full bg-gray-900 border-2 border-gray-700"
              style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" }}
            />
          )}
        </div>

        {/* Ball */}
        <div
          className={`absolute w-5 h-5 rounded-full bg-white border border-gray-300 shadow-md transition-all duration-700 ${
            result === "in"
              ? "left-[calc(100%-3.5rem)] top-1/2 -translate-y-1/2 scale-0 opacity-0"
              : result === "miss"
              ? "left-[60%] top-[20%] opacity-50"
              : result === "clown-spit"
              ? "left-[30%] top-1/2 -translate-y-1/2"
              : "left-4 top-1/2 -translate-y-1/2"
          }`}
        />
      </div>
    </div>
  );
}

// ============================================================
// Clown Reveal Component
// ============================================================

function ClownReveal({
  adminName,
  taunt,
  witnessesRequired,
  isWitnessMode,
  onContinue,
  adminImageUrl,
}: {
  adminName: string;
  taunt: string;
  witnessesRequired: number;
  isWitnessMode: boolean;
  onContinue: () => void;
  adminImageUrl?: string;
}) {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowMessage(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="text-center space-y-6">
      {/* Gatekeeper avatar */}
      {adminImageUrl ? (
        <div className="animate-bounce">
          <img
            src={adminImageUrl}
            alt={`${adminName} the Gatekeeper`}
            className="w-24 h-24 rounded-full border-4 border-red-500 mx-auto object-cover"
          />
        </div>
      ) : (
        <div className="text-6xl animate-bounce">🤡</div>
      )}
      <p className="text-lg font-bold text-gray-800">
        {adminName} the Gatekeeper
      </p>

      {showMessage && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <p className="text-gray-800 italic text-lg">
              &ldquo;{taunt}&rdquo;
            </p>
          </div>

          {!isWitnessMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-blue-900 font-semibold">
                Good try! But putting alone won&apos;t save you.
              </p>
              <p className="text-blue-700 mt-2">
                To escape the Penalty Box, you need to find{" "}
                <strong>{witnessesRequired} character witness{witnessesRequired !== 1 ? "es" : ""}</strong>{" "}
                who&apos;ll vouch for your behavior.
              </p>
            </div>
          )}

          <button
            onClick={onContinue}
            className="w-full py-3 rounded-xl font-bold text-white text-lg"
            style={{ backgroundColor: "#1e3a5f" }}
          >
            {isWitnessMode ? "Cast Your Vote" : "Find Character Witnesses"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Putting Game Component
// ============================================================

export default function PuttingGame({
  charge,
  adminName,
  clownTaunt,
  witnessesRequired,
  onComplete,
  isWitnessMode = false,
  onWitnessComplete,
  adminImageUrl,
}: PuttingGameProps) {
  const [currentHole, setCurrentHole] = useState<HoleNumber>(1);
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [attempts, setAttempts] = useState(0);
  const [ballResult, setBallResult] = useState<"rolling" | "in" | "miss" | "clown-spit">("rolling");

  const holes = getHoles(charge);
  const currentHoleConfig = holes[currentHole - 1];

  const handlePuttResult = (hit: boolean) => {
    setAttempts((prev) => prev + 1);

    if (hit) {
      if (currentHole === 3) {
        // Hole 3: clown always rejects
        setBallResult("in");
        setTimeout(() => {
          setBallResult("clown-spit");
          setTimeout(() => {
            setPhase("clown-reveal");
          }, 1000);
        }, 800);
      } else {
        // Hole 1 or 2: success, move to next hole
        setBallResult("in");
        setPhase("success");
        setTimeout(() => {
          setCurrentHole((prev) => (prev + 1) as HoleNumber);
          setPhase("intro");
          setBallResult("rolling");
        }, 1500);
      }
    } else {
      setBallResult("miss");
      setPhase("miss");
      setTimeout(() => {
        setBallResult("rolling");
        setPhase("playing");
      }, 1200);
    }
  };

  const handleClownContinue = () => {
    setPhase("complete");
    if (isWitnessMode) {
      onWitnessComplete?.();
    } else {
      onComplete();
    }
  };

  // ---- Render ----

  // Clown reveal screen
  if (phase === "clown-reveal") {
    return (
      <div className="max-w-md mx-auto p-6">
        <ClownReveal
          adminName={adminName}
          taunt={clownTaunt}
          witnessesRequired={witnessesRequired}
          isWitnessMode={isWitnessMode}
          onContinue={handleClownContinue}
          adminImageUrl={adminImageUrl}
        />
      </div>
    );
  }

  // Complete (shouldn't render — parent takes over)
  if (phase === "complete") {
    return null;
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      {/* Scorecard header */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {holes.map((h) => (
            <div
              key={h.number}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                h.number < currentHole
                  ? "bg-green-100 border-green-500 text-green-700"
                  : h.number === currentHole
                  ? "bg-white border-gray-800 text-gray-800"
                  : "bg-gray-100 border-gray-300 text-gray-400"
              }`}
            >
              {h.number < currentHole ? "✓" : h.number}
            </div>
          ))}
        </div>
        <span className="text-sm text-gray-500">
          Attempts: {attempts}
        </span>
      </div>

      {/* Hole info */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          {currentHole === 3 && adminImageUrl ? (
            <img
              src={adminImageUrl}
              alt="The Gatekeeper"
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <span className="text-2xl">
              {currentHole === 3 ? "🤡" : "⛳"}
            </span>
          )}
          <h2 className="text-xl font-bold text-gray-800">
            {currentHoleConfig.name}
          </h2>
        </div>
        <p className="text-sm text-gray-500 italic">
          {currentHoleConfig.subtitle}
        </p>
        {phase === "intro" && (
          <p className="text-sm text-gray-600 mt-2">
            {currentHoleConfig.description}
          </p>
        )}
      </div>

      {/* Ball animation area */}
      <BallAnimation result={ballResult} holeNumber={currentHole} adminImageUrl={adminImageUrl} />

      {/* Power meter */}
      {phase === "intro" && (
        <div className="text-center">
          <button
            onClick={() => setPhase("playing")}
            className="px-8 py-3 rounded-xl font-bold text-white text-lg active:scale-95"
            style={{ backgroundColor: "#1e3a5f" }}
          >
            Ready to Putt
          </button>
        </div>
      )}

      {(phase === "playing" || phase === "miss") && (
        <PowerMeter
          sweetSpotPercent={currentHoleConfig.sweetSpotPercent}
          onResult={handlePuttResult}
          disabled={phase === "miss"}
        />
      )}

      {phase === "success" && (
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600 animate-pulse">
            🎯 Great putt!
          </p>
        </div>
      )}
    </div>
  );
}
