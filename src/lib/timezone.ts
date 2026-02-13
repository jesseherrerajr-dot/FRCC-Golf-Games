/**
 * Pacific Time utilities for the FRCC Golf scheduler.
 *
 * All email schedule times (invite, reminder, confirmation) are stored
 * and configured in Pacific Time (America/Los_Angeles). Since Vercel
 * serverless functions run in UTC, we need explicit timezone conversion
 * for all date/time calculations.
 */

const PACIFIC_TZ = "America/Los_Angeles";

/**
 * Get the current date and time components in Pacific Time.
 * Returns individual components to avoid Date object timezone pitfalls.
 */
export function getNowPacific(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dateString: string; // YYYY-MM-DD
} {
  const now = new Date();

  // Use Intl.DateTimeFormat to get Pacific Time components
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "0";

  const year = parseInt(get("year"));
  const month = parseInt(get("month"));
  const day = parseInt(get("day"));
  let hour = parseInt(get("hour"));
  const minute = parseInt(get("minute"));

  // Intl hour12:false can return "24" for midnight in some environments
  if (hour === 24) hour = 0;

  // Get day of week (0=Sun, 6=Sat) in Pacific Time
  const dayOfWeek = getDayOfWeekPacific(now);

  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { year, month, day, hour, minute, dayOfWeek, dateString };
}

/**
 * Get the day of the week (0=Sun, 6=Sat) in Pacific Time.
 */
function getDayOfWeekPacific(date: Date): number {
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    weekday: "short",
  }).format(date);

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return dayMap[dayName] ?? 0;
}

/**
 * Get today's date as YYYY-MM-DD in Pacific Time.
 */
export function getTodayPacific(): string {
  return getNowPacific().dateString;
}

/**
 * Get a date N days from today in Pacific Time, as YYYY-MM-DD.
 */
export function getDateOffsetPacific(daysOffset: number): string {
  // Start from today in Pacific, then add days
  const { year, month, day } = getNowPacific();
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + daysOffset);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get the upcoming game date for a given day of the week,
 * calculated in Pacific Time.
 *
 * @param dayOfWeek - 0=Sun, 1=Mon, ..., 6=Sat
 * @returns YYYY-MM-DD string for the next occurrence of that day
 */
export function getUpcomingGameDatePacific(dayOfWeek: number): string {
  const now = getNowPacific();
  let daysUntil = dayOfWeek - now.dayOfWeek;
  if (daysUntil <= 0) daysUntil += 7;

  // Build the date from Pacific Time components to avoid UTC drift
  const gameDate = new Date(now.year, now.month - 1, now.day);
  gameDate.setDate(gameDate.getDate() + daysUntil);

  const y = gameDate.getFullYear();
  const m = String(gameDate.getMonth() + 1).padStart(2, "0");
  const d = String(gameDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Check if NOW (in Pacific Time) is within a time window of a scheduled
 * send time. Used by the email scheduler cron to decide whether to fire.
 *
 * @param sendDateString - YYYY-MM-DD of the scheduled send date
 * @param sendTime - HH:MM in Pacific Time (e.g., "10:00")
 * @param windowHours - How many hours around the scheduled time to match (default 1)
 * @returns true if current Pacific Time is within the window
 */
export function isWithinSendWindow(
  sendDateString: string,
  sendTime: string,
  windowHours: number = 1
): boolean {
  const now = getNowPacific();
  const [sendHour, sendMinute] = sendTime.split(":").map(Number);

  // Compare dates first
  if (now.dateString !== sendDateString) {
    return false;
  }

  // Both times are in Pacific — simple numeric comparison
  const nowMinutes = now.hour * 60 + now.minute;
  const sendMinutes = sendHour * 60 + sendMinute;
  const diffMinutes = Math.abs(nowMinutes - sendMinutes);

  return diffMinutes <= windowHours * 60;
}

/**
 * Calculate a send date by applying a day offset to a game date string.
 * Pure date arithmetic — no timezone concerns since we're working with
 * YYYY-MM-DD strings.
 *
 * @param gameDateString - YYYY-MM-DD
 * @param dayOffset - Number of days to add (negative = before game day)
 * @returns YYYY-MM-DD string
 */
export function calculateSendDateString(
  gameDateString: string,
  dayOffset: number
): string {
  const [year, month, day] = gameDateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayOffset);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
