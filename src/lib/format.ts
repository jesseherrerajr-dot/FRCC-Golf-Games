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

/**
 * Format a date string as a readable date (timezone-safe)
 */
export function formatDate(dateStr: string): string {
  // Parse date components to avoid timezone issues
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
 * Format a timestamp as a readable date and time
 */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
