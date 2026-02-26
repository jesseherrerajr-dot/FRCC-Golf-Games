"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getEvents,
  getActiveMembers,
  getPlayingPartnerPreferences,
  addPlayingPartner,
  removePlayingPartner,
  updatePartnerRank,
} from "./actions";

type Event = {
  id: string;
  name: string;
  allow_playing_partner_preferences: boolean;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Partner = {
  id: string;
  preferred_partner_id: string;
  rank: number;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
};

export default function PreferencesPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState<string | null>(null); // track which row is being moved
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load events on mount
  useEffect(() => {
    async function loadEvents() {
      const eventsData = await getEvents();
      setEvents(eventsData);
      if (eventsData.length > 0) {
        setSelectedEvent(eventsData[0].id);
      }
      const membersData = await getActiveMembers();
      setAllMembers(membersData);
      setLoading(false);
    }
    loadEvents();
  }, []);

  // Load preferences when event changes
  useEffect(() => {
    if (selectedEvent) {
      loadEventPreferences();
    }
  }, [selectedEvent]);

  async function loadEventPreferences() {
    if (!selectedEvent) return;
    const partnersData = await getPlayingPartnerPreferences(selectedEvent);
    setPartners(partnersData);
  }

  // Filter members for dropdown (exclude already selected and self)
  const filteredMembers = allMembers.filter((member) => {
    const partnerIds = partners.map((p) => p.preferred_partner_id);
    const matchesSearch =
      searchQuery === "" ||
      `${member.first_name} ${member.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    return !partnerIds.includes(member.id) && matchesSearch;
  });

  async function handleAddPartner(partnerId: string) {
    if (!selectedEvent) return;
    const result = await addPlayingPartner(selectedEvent, partnerId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Playing partner added successfully" });
      setSearchQuery("");
      setShowDropdown(false);
      loadEventPreferences();
    }
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleRemovePartner(preferenceId: string) {
    if (!selectedEvent) return;
    const result = await removePlayingPartner(preferenceId, selectedEvent);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Playing partner removed successfully" });
      loadEventPreferences();
    }
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleMovePartner(preferenceId: string, direction: "up" | "down") {
    if (!selectedEvent) return;
    const partner = partners.find((p) => p.id === preferenceId);
    if (!partner) return;

    const newRank = direction === "up" ? partner.rank - 1 : partner.rank + 1;
    if (newRank < 1 || newRank > partners.length) return;

    setReordering(preferenceId);
    const result = await updatePartnerRank(preferenceId, selectedEvent, newRank);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      setTimeout(() => setMessage(null), 3000);
    } else {
      await loadEventPreferences();
    }
    setReordering(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  if (events.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500">No events available.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-teal-700 hover:text-teal-600"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="text-sm text-teal-700 hover:text-teal-600"
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
              Playing Partner Preferences
            </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your preferred playing partners for each event.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-teal-200 bg-navy-50 text-teal-600"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Event Selector */}
        {events.length > 1 && (
          <div className="mb-6">
            <label
              htmlFor="event"
              className="block text-sm font-medium text-gray-700"
            >
              Event
            </label>
            <select
              id="event"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Check if playing partners are disabled for this event */}
        {!events.find((e) => e.id === selectedEvent)?.allow_playing_partner_preferences ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-600">
              Playing partner preferences are not available for this event.
            </p>
          </div>
        ) : (
          /* Playing Partners */
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Playing Partners{" "}
            <span className="text-sm font-normal text-gray-500">
              ({partners.length}/10)
            </span>
          </h2>

          {/* Search/Add */}
          {partners.length < 10 && (
            <div className="relative mb-6">
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-700"
              >
                Add Playing Partner
              </label>
              <input
                id="search"
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
              {showDropdown && filteredMembers.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredMembers.slice(0, 50).map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleAddPartner(member.id)}
                      className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">
                        {member.first_name} {member.last_name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Current Partners List */}
          {partners.length === 0 ? (
            <p className="text-sm text-gray-500">
              No playing partners selected. Add up to 10 preferred partners to help
              with groupings.
            </p>
          ) : (
            <div className="space-y-2">
              {partners.map((partner, index) => (
                <div
                  key={partner.id}
                  className={`flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 ${
                    reordering === partner.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Up/Down arrows */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMovePartner(partner.id, "up")}
                        disabled={index === 0 || reordering !== null}
                        className={`rounded px-1.5 py-0.5 text-xs leading-none ${
                          index === 0 || reordering !== null
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                        }`}
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePartner(partner.id, "down")}
                        disabled={index === partners.length - 1 || reordering !== null}
                        className={`rounded px-1.5 py-0.5 text-xs leading-none ${
                          index === partners.length - 1 || reordering !== null
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                        }`}
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {index + 1}. {partner.profiles.first_name}{" "}
                      {partner.profiles.last_name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePartner(partner.id)}
                    disabled={reordering !== null}
                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400">
            These preferences are suggestions and help admins with groupings. They
            do not guarantee you&apos;ll be paired with these players.
          </p>
        </div>
        )}
        </div>
      </main>
  );
}
