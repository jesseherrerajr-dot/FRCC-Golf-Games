"use client";

import { useState, useEffect } from "react";
import { createGuestRequest, getPastGuests } from "./guest-actions";

/** Format phone as (XXX) XXX-XXXX as the user types.
 *  Strips leading US country code (+1 or 1) from Chrome autofill. */
function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  // Strip leading "1" country code if we got 11 digits (e.g., +1 from autofill)
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type PastGuest = {
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string;
  guest_ghin_number: string;
};

export function GuestRequestForm({ token, remainingSlots }: { token: string; remainingSlots: number }) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [ghin, setGhin] = useState("");

  // Past guests
  const [pastGuests, setPastGuests] = useState<PastGuest[]>([]);
  const [selectedGuestEmail, setSelectedGuestEmail] = useState("");

  // Fetch past guests when form is shown
  useEffect(() => {
    if (showForm) {
      getPastGuests(token).then(setPastGuests);
    }
  }, [showForm, token]);

  // Handle selecting a past guest from dropdown
  function handleSelectPastGuest(guestEmail: string) {
    setSelectedGuestEmail(guestEmail);

    if (!guestEmail) {
      // Clear form if "Select a guest" is chosen
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setGhin("");
      return;
    }

    const guest = pastGuests.find((g) => g.guest_email === guestEmail);
    if (guest) {
      setFirstName(guest.guest_first_name);
      setLastName(guest.guest_last_name);
      setEmail(guest.guest_email);
      setPhone(formatPhone(guest.guest_phone));
      setGhin(guest.guest_ghin_number);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.append("token", token);

    const result = await createGuestRequest(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setShowForm(false);
      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setGhin("");
      setSelectedGuestEmail("");
    }
  }

  if (success) {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
        <h3 className="font-semibold text-green-800">Guest Request Submitted</h3>
        <p className="mt-1 text-sm text-green-700">
          Your guest request has been submitted. An admin will review it after the
          Friday cutoff and notify you if approved.
        </p>
      </div>
    );
  }

  if (!showForm) {
    const isFirstGuest = remainingSlots === 3;
    return (
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-800">
          {isFirstGuest ? "Bring a Guest?" : "Request Another Guest?"}
        </h3>
        <p className="mt-1 text-sm text-blue-700">
          {isFirstGuest
            ? "Want to bring a guest this week? Submit a request and an admin will review it after the Friday cutoff."
            : `You can request up to ${remainingSlots} more guest${remainingSlots !== 1 ? "s" : ""} for this week.`
          }
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          {isFirstGuest ? "Request a Guest" : "Request Another Guest"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-gray-800">Request a Guest</h3>
      <p className="mt-1 text-sm text-gray-600">
        Provide your guest's information below. All fields are required.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {/* Past Guests Dropdown */}
        {pastGuests.length > 0 && (
          <div>
            <label
              htmlFor="past_guest"
              className="block text-sm font-medium text-gray-700"
            >
              Select a Previous Guest (optional)
            </label>
            <select
              id="past_guest"
              value={selectedGuestEmail}
              onChange={(e) => handleSelectPastGuest(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="">-- Or enter new guest details below --</option>
              {pastGuests.map((guest) => (
                <option key={guest.guest_email} value={guest.guest_email}>
                  {guest.guest_first_name} {guest.guest_last_name} ({guest.guest_email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Select a guest you've brought before to auto-fill their info
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="guest_first_name"
              className="block text-sm font-medium text-gray-700"
            >
              First Name
            </label>
            <input
              type="text"
              id="guest_first_name"
              name="guest_first_name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label
              htmlFor="guest_last_name"
              className="block text-sm font-medium text-gray-700"
            >
              Last Name
            </label>
            <input
              type="text"
              id="guest_last_name"
              name="guest_last_name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="guest_email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            type="email"
            id="guest_email"
            name="guest_email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div>
          <label
            htmlFor="guest_phone"
            className="block text-sm font-medium text-gray-700"
          >
            Phone
          </label>
          <input
            type="tel"
            id="guest_phone"
            name="guest_phone"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(555) 123-4567"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <p className="mt-1 text-xs text-gray-400">US 10-digit format</p>
        </div>

        <div>
          <label
            htmlFor="guest_ghin"
            className="block text-sm font-medium text-gray-700"
          >
            GHIN Number
          </label>
          <input
            type="text"
            id="guest_ghin"
            name="guest_ghin"
            value={ghin}
            onChange={(e) => setGhin(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setError("");
              setFirstName("");
              setLastName("");
              setEmail("");
              setPhone("");
              setGhin("");
              setSelectedGuestEmail("");
            }}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function GuestRequestStatus({
  guestRequests,
  remainingSlots,
}: {
  guestRequests: Array<{
    guest_first_name: string;
    guest_last_name: string;
    status: string;
  }>;
  remainingSlots: number;
}) {
  const statusColors: Record<string, string> = {
    pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
    approved: "border-green-200 bg-green-50 text-green-700",
    denied: "border-red-200 bg-red-50 text-red-700",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pending Review",
    approved: "Approved",
    denied: "Denied",
  };

  const statusIcons: Record<string, string> = {
    pending: "⏳",
    approved: "✓",
    denied: "✗",
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">
          Your Guest Requests ({guestRequests.length}/3)
        </h3>
        <span className="text-xs text-gray-500">
          {remainingSlots > 0 && `${remainingSlots} slot${remainingSlots !== 1 ? "s" : ""} remaining`}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {guestRequests.map((guest, index) => (
          <li
            key={index}
            className={`rounded-md border px-3 py-2 text-sm ${statusColors[guest.status] || statusColors.pending}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {statusIcons[guest.status]} {guest.guest_first_name}{" "}
                {guest.guest_last_name}
              </span>
              <span className="text-xs">
                {statusLabels[guest.status] || "Unknown"}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {guestRequests.some((g) => g.status === "pending") && (
        <p className="mt-3 text-xs text-gray-500">
          Guest requests must be approved by the event admin and the pro shop before they will be confirmed to play.
        </p>
      )}
    </div>
  );
}
