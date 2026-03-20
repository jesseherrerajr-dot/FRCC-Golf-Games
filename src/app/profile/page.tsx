"use client";

import { useActionState, useState, useEffect, useMemo } from "react";
import { updateProfile, type ProfileFormState } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { getSubscribedEvents } from "./preferences-actions";
import { PlayingPartnerPreferencesSection } from "./playing-partner-preferences";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  useFieldValidation,
  FieldError,
  fieldBorderClass,
  validators,
} from "@/components/form-field";

const initialState: ProfileFormState = {};

type SubscribedEvent = {
  event_id: string;
  event_name: string;
  allow_playing_partner_preferences: boolean;
};

/** Format phone as (XXX) XXX-XXXX.
 *  Strips leading US country code (+1 or 1) from Chrome autofill. */
function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type Profile = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  ghin_number: string;
  handicap_index: number | null;
  handicap_updated_at: string | null;
  status: string;
};

export default function ProfilePage() {
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [subscribedEvents, setSubscribedEvents] = useState<SubscribedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const fieldDefs = useMemo(() => ({
    firstName: [validators.required("First name")],
    lastName: [validators.required("Last name")],
    email: [validators.required("Email"), validators.email()],
    phone: [validators.phone()],
  }), []);
  const { errors, touched, handleBlur, validateAll } = useFieldValidation(fieldDefs);

  // Load profile data and subscribed events on mount
  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setPhone(formatPhone(profileData.phone || ""));
      }

      // Load subscribed events
      const eventsData = await getSubscribedEvents();
      setSubscribedEvents(eventsData);

      setLoading(false);
    }
    loadData();
  }, []);

  function toggleEventExpanded(eventId: string) {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">
          Profile not found.{" "}
          <Link href="/login" className="text-teal-700 hover:text-teal-600">
            Sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-md">
          {/* Header */}
          <div className="mb-6">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/home" },
                { label: "Profile" },
              ]}
            />
            <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
              Profile Settings
            </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your contact info is only shared with the Event Admins and the
            Pro Shop for the purposes of communicating with you and setting up
            tee times.
          </p>
        </div>

        {/* Form */}
        <form
          action={(formData) => {
            if (!validateAll(formData)) return;
            formAction(formData);
          }}
          className="space-y-5"
        >
          {/* Success message */}
          {state.success && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
              Profile updated successfully.
            </div>
          )}

          {/* Error message */}
          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          {/* First Name */}
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700"
            >
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              defaultValue={profile.first_name}
              onBlur={(e) => handleBlur("firstName", e.target.value)}
              className={`mt-1 block w-full rounded-lg border bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${fieldBorderClass(errors.firstName, touched.firstName)}`}
            />
            <FieldError error={errors.firstName} touched={touched.firstName} />
          </div>

          {/* Last Name */}
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700"
            >
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              defaultValue={profile.last_name}
              onBlur={(e) => handleBlur("lastName", e.target.value)}
              className={`mt-1 block w-full rounded-lg border bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${fieldBorderClass(errors.lastName, touched.lastName)}`}
            />
            <FieldError error={errors.lastName} touched={touched.lastName} />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={profile.email}
              onBlur={(e) => handleBlur("email", e.target.value)}
              className={`mt-1 block w-full rounded-lg border bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${fieldBorderClass(errors.email, touched.email)}`}
            />
            <FieldError error={errors.email} touched={touched.email} />
            {!errors.email && (
              <p className="mt-1 text-xs text-gray-400">
                Changing your email will require re-verification.
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700"
            >
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onBlur={(e) => handleBlur("phone", e.target.value)}
              className={`mt-1 block w-full rounded-lg border bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${fieldBorderClass(errors.phone, touched.phone)}`}
              placeholder="(555) 123-4567"
            />
            <FieldError error={errors.phone} touched={touched.phone} />
            {!errors.phone && <p className="mt-1 text-xs text-gray-400">US 10-digit format</p>}
          </div>

          {/* GHIN Number */}
          <div>
            <label
              htmlFor="ghin"
              className="block text-sm font-medium text-gray-700"
            >
              GHIN Number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="ghin"
              name="ghin"
              type="text"
              inputMode="numeric"
              defaultValue={profile.ghin_number}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              placeholder="1234567"
            />
            <p className="mt-1 text-xs text-gray-400">
              Your USGA Golf Handicap ID
            </p>
            {profile.handicap_index != null && (
              <div className="mt-2 rounded-md bg-teal-50 px-3 py-2">
                <p className="text-sm text-teal-800">
                  Current Handicap Index: <span className="font-semibold">{Number(profile.handicap_index).toFixed(1)}</span>
                  {profile.handicap_updated_at && (
                    <span className="ml-1 text-xs text-teal-600">
                      (updated {new Date(profile.handicap_updated_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" })})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Account status (read-only) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-500">
              Account Status:{" "}
              <span className="font-medium capitalize text-gray-900">
                {profile.status?.replace(/_/g, " ")}
              </span>
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Playing Partner Preferences Section */}
        {subscribedEvents.length > 0 && (
          <div className="mt-12 border-t border-gray-200 pt-12">
            <h2 className="mb-2 text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
              Playing Partner Preferences
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              Rank your preferred playing partners for each event. Higher-ranked
              partners have more weight in suggested groupings. Your preferences
              are private — only you can see them. You can update them at any time.
            </p>

            <div className="space-y-3">
              {subscribedEvents.map((event) => (
                <div key={event.event_id} className="border border-gray-200 rounded-lg">
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => toggleEventExpanded(event.event_id)}
                    className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 px-4 py-3 rounded-lg transition-colors"
                  >
                    <h3 className="font-semibold text-gray-900">
                      {event.event_name}
                    </h3>
                    <svg
                      className={`h-4 w-4 text-gray-500 transition-transform ${
                        expandedEvents.has(event.event_id) ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {/* Collapsible content */}
                  {expandedEvents.has(event.event_id) && (
                    <div className="p-4 border-t border-gray-200">
                      <PlayingPartnerPreferencesSection
                        eventId={event.event_id}
                        eventName={event.event_name}
                        preferencesEnabled={event.allow_playing_partner_preferences}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </main>
  );
}
