"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  getActiveGolfersByEvent,
  getPlayingPartnerPreferences,
  addPlayingPartner,
  removePlayingPartner,
  updatePartnerRank,
} from "./preferences-actions";

type Golfer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Partner = {
  id: string;
  preferred_partner_id: string;
  rank: number;
  profiles: any;
};

interface PlayingPartnerPreferencesProps {
  eventId: string;
  eventName: string;
  preferencesEnabled: boolean;
}

export function PlayingPartnerPreferencesSection({
  eventId,
  eventName,
  preferencesEnabled,
}: PlayingPartnerPreferencesProps) {
  const [eventGolfers, setEventGolfers] = useState<Golfer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const { showToast } = useToast();

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      const [golfersData, partnersData] = await Promise.all([
        getActiveGolfersByEvent(eventId),
        getPlayingPartnerPreferences(eventId),
      ]);
      setEventGolfers(golfersData);
      setPartners(partnersData);
      setLoading(false);
    }
    loadData();
  }, [eventId]);

  // Filter golfers for dropdown (exclude already selected and self)
  const filteredGolfers = eventGolfers.filter((golfer) => {
    const partnerIds = partners.map((p) => p.preferred_partner_id);
    const matchesSearch =
      searchQuery === "" ||
      `${golfer.first_name} ${golfer.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      golfer.email.toLowerCase().includes(searchQuery.toLowerCase());
    return !partnerIds.includes(golfer.id) && matchesSearch;
  });

  async function handleAddPartner(partnerId: string) {
    const result = await addPlayingPartner(eventId, partnerId);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast("Playing partner added");
      setSearchQuery("");
      setShowDropdown(false);
      // Reload preferences
      const partnersData = await getPlayingPartnerPreferences(eventId);
      setPartners(partnersData);
    }
  }

  async function handleRemovePartner(preferenceId: string) {
    const result = await removePlayingPartner(preferenceId, eventId);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast("Playing partner removed");
      const partnersData = await getPlayingPartnerPreferences(eventId);
      setPartners(partnersData);
    }
  }

  async function handleMovePartner(preferenceId: string, direction: "up" | "down") {
    const partner = partners.find((p) => p.id === preferenceId);
    if (!partner) return;

    const newRank = direction === "up" ? partner.rank - 1 : partner.rank + 1;
    if (newRank < 1 || newRank > partners.length) return;

    setReordering(preferenceId);
    const result = await updatePartnerRank(preferenceId, eventId, newRank);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      const partnersData = await getPlayingPartnerPreferences(eventId);
      setPartners(partnersData);
    }
    setReordering(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-teal-600" />
      </div>
    );
  }

  if (!preferencesEnabled) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          Playing partner preferences are not available for this event.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {eventName}{" "}
          <span className="text-sm font-normal text-gray-500">
            ({partners.length}/10)
          </span>
        </h3>

        {/* Search/Add */}
        {partners.length < 10 && (
          <div className="relative mb-6">
            <label
              htmlFor={`search-${eventId}`}
              className="block text-sm font-medium text-gray-700"
            >
              Add Playing Partner
            </label>
            <input
              id={`search-${eventId}`}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by name..."
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />

            {/* Dropdown */}
            {showDropdown && filteredGolfers.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredGolfers.slice(0, 50).map((golfer) => (
                  <button
                    key={golfer.id}
                    type="button"
                    onClick={() => handleAddPartner(golfer.id)}
                    className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">
                      {golfer.first_name} {golfer.last_name}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Current Partners List */}
        {partners.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-600">
              No partners added yet.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Search for golfers above to add up to 10 preferred playing
              partners. The grouping engine uses these rankings when building
              foursomes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {partners.map((partner, index) => (
              <div
                key={partner.id}
                className={`flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 sm:px-4 sm:py-3 ${
                  reordering === partner.id ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Up/Down arrows — larger touch targets */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMovePartner(partner.id, "up")}
                      disabled={index === 0 || reordering !== null}
                      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm leading-none transition-colors ${
                        index === 0 || reordering !== null
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-500 hover:bg-gray-200 hover:text-gray-700 active:bg-gray-300"
                      }`}
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMovePartner(partner.id, "down")}
                      disabled={index === partners.length - 1 || reordering !== null}
                      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm leading-none transition-colors ${
                        index === partners.length - 1 || reordering !== null
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-500 hover:bg-gray-200 hover:text-gray-700 active:bg-gray-300"
                      }`}
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    <span className="text-gray-400 mr-1">{index + 1}.</span>
                    {partner.profiles.first_name}{" "}
                    {partner.profiles.last_name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRemoveTarget({
                      id: partner.id,
                      name: `${partner.profiles.first_name} ${partner.profiles.last_name}`,
                    })
                  }
                  disabled={reordering !== null}
                  className="rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Your preferences are private — only you can see them, and you can
          change them at any time. The system uses them behind the scenes when
          building suggested foursomes, but they don&apos;t guarantee
          you&apos;ll be paired with these players.
        </p>
      </div>

      {/* Remove confirmation modal */}
      <ConfirmModal
        open={removeTarget !== null}
        title="Remove Partner"
        message={`Remove ${removeTarget?.name || ""} from your preferred playing partners?`}
        confirmLabel="Remove"
        variant="danger"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            handleRemovePartner(removeTarget.id);
            setRemoveTarget(null);
          }
        }}
      />
    </>
  );
}
