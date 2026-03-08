/**
 * FRCC Golf Games — Display Formatting Utilities
 *
 * TIMEZONE RULE: All timestamps from the database (timestamptz columns like
 * sent_at, created_at, responded_at) MUST be formatted with
 * timeZone: "America/Los_Angeles" to display in Pacific Time.
 *
 * Game dates (YYYY-MM-DD strings like game_date) are NOT timestamps — they
 * are calendar dates with no time component. Format them by parsing the
 * components directly (new Date(year, month-1, day)) to avoid UTC drift.
 *
 * NEVER use .toLocaleDateString() or .toLocaleString() without an explicit
 * timeZone option when formatting database timestamps. On Vercel (UTC
 * environment), omitting timeZone produces UTC output, not Pacific.
 */

const PACIFIC_TZ = "America/Los_Angeles";

// ─────────────────────────────────────────────────────────
// Name formatting
// ─────────────────────────────────────────────────────────

/**
 * Format a name as "J. Herrera" (first initial + last name).
 * Used for golfer-facing displays (RSVP lists, confirmation emails).
 */
export function formatInitialLastName(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}. ${lastName}`;
}

/**
 * Format a full name as "Jesse Herrera".
 * Used for admin displays, pro shop emails, and internal references.
 */
export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

/**
 * Format a sponsor name as "Jesse H." (first name + last initial).
 * Used in guest labels like "(Guest of Jesse H.)"
 */
export function formatSponsorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName.charAt(0)}.`;
}

// ─────────────────────────────────────────────────────────
// Phone formatting
// ─────────────────────────────────────────────────────────

/**
 * Format a phone number as (XXX) XXX-XXXX
 * Handles various input formats and cleans to 10 digits
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "—";

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Handle 11-digit numbers with leading 1 (US country code)
  const cleaned = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;

  // Must be exactly 10 digits
  if (cleaned.length !== 10) return phone; // Return as-is if not valid

  // Format as (XXX) XXX-XXXX
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

// ─────────────────────────────────────────────────────────
// Game date formatting (YYYY-MM-DD strings — no timezone)
// ─────────────────────────────────────────────────────────

/**
 * Format a game date string (YYYY-MM-DD) as a full readable date.
 * Example: "2026-03-07" → "Saturday, March 7, 2026"
 *
 * Parses components directly to avoid UTC drift — do NOT pass through
 * new Date(dateStr) which interprets as UTC midnight.
 */
export function formatGameDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a game date string (YYYY-MM-DD) as a short date.
 * Example: "2026-03-07" → "Sat, Mar 7"
 */
export function formatGameDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a game date string (YYYY-MM-DD) for email subjects.
 * Example: "2026-03-07" → "March 7, 2026"
 */
export function formatGameDateForEmail(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a game date string (YYYY-MM-DD) for email subjects (no year).
 * Example: "2026-03-07" → "March 7"
 */
export function formatGameDateMonthDay(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

/**
 * @deprecated Use formatGameDate() instead. Kept for backward compatibility.
 */
export function formatDate(dateStr: string): string {
  return formatGameDate(dateStr);
}

// ─────────────────────────────────────────────────────────
// Timestamp formatting (timestamptz from DB — ALWAYS Pacific)
// ─────────────────────────────────────────────────────────

/**
 * Format a database timestamp as a readable date and time in Pacific Time.
 * Example: "2026-03-06T16:29:00+00:00" → "Mar 6, 9:29 AM"
 *
 * Use this for: sent_at, created_at, responded_at, updated_at, etc.
 */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    timeZone: PACIFIC_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a database timestamp as a date only in Pacific Time.
 * Example: "2026-03-06T16:29:00+00:00" → "Mar 6, 2026"
 *
 * Use this for: created_at on golfer pages, etc.
 */
export function formatDateTimeDateOnly(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: PACIFIC_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a database timestamp as a full date and time with timezone label.
 * Example: "2026-03-06T16:29:00+00:00" → "Fri, Mar 6, 9:29 AM PST"
 *
 * Use this for: admin summary emails, audit displays.
 */
export function formatDateTimeFull(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    timeZone: PACIFIC_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

// ─────────────────────────────────────────────────────────
// Site URL
// ─────────────────────────────────────────────────────────

/**
 * Get the site URL from environment, with consistent fallback.
 * Use this instead of inline `process.env.NEXT_PUBLIC_SITE_URL || "..."`.
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
