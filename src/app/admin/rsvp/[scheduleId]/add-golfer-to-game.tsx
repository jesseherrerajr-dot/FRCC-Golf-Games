"use client";

import { useState, useTransition, useEffect } from "react";
import { useToast } from "@/components/toast";
import { getEligibleGolfersForGame, adminAddGolferToGame } from "./actions";

type EligibleGolfer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export function AddGolferToGame({
  scheduleId,
  eventId,
}: {
  scheduleId: string;
  eventId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [golfers, setGolfers] = useState<EligibleGolfer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addAsIn, setAddAsIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  // Fetch eligible golfers when opened
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    getEligibleGolfersForGame(scheduleId, eventId)
      .then((result) => {
        setGolfers(result.golfers);
        if (result.error) {
          showToast(result.error, "error");
        }
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, scheduleId, eventId, showToast]);

  const filtered = search.trim()
    ? golfers.filter(
        (g) =>
          `${g.first_name} ${g.last_name}`
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          g.email.toLowerCase().includes(search.toLowerCase())
      )
    : golfers;

  const selectedGolfer = golfers.find((g) => g.id === selectedId);

  function handleAdd() {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await adminAddGolferToGame(
        selectedId,
        scheduleId,
        addAsIn ? "in" : "no_response"
      );
      if (result.error) {
        showToast(result.error, "error");
      } else {
        const name = selectedGolfer
          ? `${selectedGolfer.first_name} ${selectedGolfer.last_name}`
          : "Golfer";
        showToast(`${name} added to game${addAsIn ? " as In" : ""}`);
        setSelectedId(null);
        setSearch("");
        setIsOpen(false);
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm hover:border-teal-400 hover:text-teal-700 transition w-full justify-center"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        Add Golfer to Game
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Add Golfer to Game
        </h3>
        <button
          onClick={() => {
            setIsOpen(false);
            setSelectedId(null);
            setSearch("");
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Add a subscribed golfer who wasn&apos;t included in this week&apos;s
        invite (e.g., recently approved).
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-500 py-2">Loading eligible golfers…</p>
      ) : golfers.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">
          All subscribed golfers already have an RSVP for this game.
        </p>
      ) : (
        <>
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedId(null);
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />

          {/* Results */}
          {search.trim() && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">
                  No matching golfers
                </p>
              ) : (
                filtered.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedId(g.id);
                      setSearch(`${g.first_name} ${g.last_name}`);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-teal-50 ${
                      selectedId === g.id
                        ? "bg-teal-100 font-medium"
                        : ""
                    }`}
                  >
                    <span className="font-medium text-gray-900">
                      {g.first_name} {g.last_name}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {g.email}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected golfer + options */}
          {selectedId && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="addStatus"
                    checked={addAsIn}
                    onChange={() => setAddAsIn(true)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  Add as &quot;In&quot; (confirmed)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="addStatus"
                    checked={!addAsIn}
                    onChange={() => setAddAsIn(false)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  Add as &quot;No Reply&quot;
                </label>
              </div>

              <button
                onClick={handleAdd}
                disabled={isPending}
                className="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50"
              >
                {isPending
                  ? "Adding…"
                  : `Add ${selectedGolfer?.first_name} ${selectedGolfer?.last_name}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
