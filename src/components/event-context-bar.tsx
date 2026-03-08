"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Event {
  id: string;
  name: string;
}

export function EventContextBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [allAdminEvents, setAllAdminEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Extract eventId from URL (e.g., /admin/events/[eventId]/...)
  const eventIdMatch = pathname.match(/\/admin\/events\/([^/]+)/);
  const eventId = eventIdMatch?.[1];

  // Only show on event-specific pages
  const isEventPage = !!eventId;

  useEffect(() => {
    if (!isEventPage) {
      setIsLoading(false);
      return;
    }

    const loadEvents = async () => {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsLoading(false);
          return;
        }

        // Get current user's profile to check if super admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_super_admin")
          .eq("id", user.id)
          .single();

        if (!profile) {
          setIsLoading(false);
          return;
        }

        // Fetch accessible events
        let query = supabase
          .from("events")
          .select("id, name")
          .eq("is_active", true)
          .order("name");

        // Super admins see all events; event admins see only their assigned events
        if (!profile.is_super_admin) {
          const { data: eventAdmins } = await supabase
            .from("event_admins")
            .select("event_id")
            .eq("profile_id", user.id);

          if (!eventAdmins || eventAdmins.length === 0) {
            setIsLoading(false);
            return;
          }

          const eventIds = eventAdmins.map((ea) => ea.event_id);
          query = query.in("id", eventIds);
        }

        const { data: events } = await query;

        if (events) {
          setAllAdminEvents(events);
          const current = events.find((e) => e.id === eventId);
          setCurrentEvent(current || null);
        }
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, [eventId, isEventPage, supabase]);

  if (!isEventPage || isLoading) {
    return null;
  }

  if (!currentEvent) {
    return null;
  }

  // Other events the admin can switch to
  const otherEvents = allAdminEvents.filter((e) => e.id !== currentEvent.id);

  // Extract the sub-path (e.g., /settings, /golfers, /schedule, etc.)
  const subPathMatch = pathname.match(/\/admin\/events\/[^/]+(.*)$/);
  const subPath = subPathMatch?.[1] || "";

  const handleSwitchEvent = (newEventId: string) => {
    router.push(`/admin/events/${newEventId}${subPath}`);
    setIsOpen(false);
  };

  return (
    <div className="border-b border-teal-200 bg-teal-50 px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Event:
          </span>
          <span className="text-lg font-bold text-navy-900">{currentEvent.name}</span>
        </div>

        {otherEvents.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-2 py-1 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-200"
            >
              Switch Event
              <svg
                className={`h-4 w-4 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-md border border-teal-200 bg-white shadow-lg">
                {otherEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => handleSwitchEvent(event.id)}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-teal-50 hover:text-teal-900 first:rounded-t-md last:rounded-b-md"
                  >
                    {event.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
