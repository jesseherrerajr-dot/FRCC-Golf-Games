/**
 * RSVP Status Constants
 *
 * Centralized status labels, colors, and type definitions for RSVP statuses.
 * Import from this file instead of defining inline in each page.
 */

export type RsvpStatus = "in" | "out" | "not_sure" | "no_response" | "waitlisted";

/**
 * Golfer-facing status labels (used on RSVP page, dashboard).
 * Example: "I'm In", "I'm Out", "Not Sure Yet"
 */
export const RSVP_GOLFER_LABELS: Record<RsvpStatus, string> = {
  in: "I'm In",
  out: "I'm Out",
  not_sure: "Not Sure Yet",
  no_response: "No Response",
  waitlisted: "Waitlisted",
};

/**
 * Admin-facing status labels (used on admin RSVP page, controls).
 * Shorter labels: "In", "Out", "Not Sure"
 */
export const RSVP_ADMIN_LABELS: Record<RsvpStatus, string> = {
  in: "In",
  out: "Out",
  not_sure: "Not Sure",
  no_response: "No Response",
  waitlisted: "Waitlisted",
};

/**
 * Golfer-facing badge colors (RSVP page, dashboard).
 * Includes border classes for badge styling.
 */
export const RSVP_GOLFER_COLORS: Record<RsvpStatus, string> = {
  in: "bg-teal-100 text-teal-800 border-teal-200",
  out: "bg-red-100 text-red-800 border-red-200",
  not_sure: "bg-yellow-100 text-yellow-800 border-yellow-200",
  no_response: "bg-gray-100 text-gray-600 border-gray-200",
  waitlisted: "bg-orange-100 text-orange-800 border-orange-200",
};

/**
 * Admin-facing badge colors (admin RSVP page).
 */
export const RSVP_ADMIN_COLORS: Record<RsvpStatus, string> = {
  in: "bg-teal-100 text-navy-900",
  out: "bg-red-100 text-red-800",
  not_sure: "bg-yellow-100 text-yellow-800",
  no_response: "bg-gray-100 text-gray-600",
  waitlisted: "bg-orange-100 text-orange-800",
};

/**
 * Admin status dropdown options (for RSVP override controls).
 */
export const RSVP_ADMIN_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
  { value: "not_sure", label: "Not Sure" },
  { value: "no_response", label: "No Response" },
  { value: "waitlisted", label: "Waitlisted" },
];
