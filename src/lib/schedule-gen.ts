import type { Event } from "@/types/events";
import { getTodayPacific } from "@/lib/timezone";

/**
 * Calculate the effective end date of an event based on its duration_mode.
 * Returns null for indefinite events.
 */
export function calculateEventEndDate(event: Event): string | null {
  if (event.duration_mode === "indefinite") {
    return null;
  }

  if (event.duration_mode === "end_date" && event.end_date) {
    return event.end_date;
  }

  if (
    event.duration_mode === "fixed_weeks" &&
    event.start_date &&
    event.duration_weeks
  ) {
    const [year, month, day] = event.start_date.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    start.setDate(start.getDate() + event.duration_weeks * 7);
    return formatDateString(start);
  }

  return null;
}

/**
 * Generate game dates based on event frequency and day of week.
 * Returns YYYY-MM-DD strings between startDate and endDate (inclusive).
 */
export function generateGameDates(
  dayOfWeek: number,
  frequency: "weekly" | "biweekly" | "monthly",
  startDateStr: string,
  endDateStr: string
): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const current = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);

  // Align to the next occurrence of dayOfWeek
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1);
  }

  // If we overshot the start, that's fine — we want future dates
  const frequencyDays =
    frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 28;

  while (current <= endDate) {
    dates.push(formatDateString(current));
    current.setDate(current.getDate() + frequencyDays);
  }

  return dates;
}

/**
 * Generate event_schedules rows up to 8 weeks ahead for an event.
 * Respects the event's end_date if set.
 * Returns the number of new schedules created.
 */
export async function generateSchedulesForEvent(
  supabase: { from: (table: string) => any },
  event: Event
): Promise<number> {
  const today = getTodayPacific();
  const [ty, tm, td] = today.split("-").map(Number);
  const eightWeeksOut = new Date(ty, tm - 1, td);
  eightWeeksOut.setDate(eightWeeksOut.getDate() + 56); // 8 weeks

  // Determine the effective end boundary
  const eventEndDate = calculateEventEndDate(event);
  let effectiveEnd: Date;

  if (eventEndDate) {
    const [ey, em, ed] = eventEndDate.split("-").map(Number);
    const eventEnd = new Date(ey, em - 1, ed);
    effectiveEnd = eventEnd < eightWeeksOut ? eventEnd : eightWeeksOut;
  } else {
    effectiveEnd = eightWeeksOut;
  }

  const endStr = formatDateString(effectiveEnd);

  // Generate all game dates in the range
  const gameDates = generateGameDates(
    event.day_of_week,
    event.frequency,
    today,
    endStr
  );

  if (gameDates.length === 0) return 0;

  // Get existing schedules in this range
  const { data: existing } = await supabase
    .from("event_schedules")
    .select("game_date")
    .eq("event_id", event.id)
    .gte("game_date", today)
    .lte("game_date", endStr);

  const existingDates = new Set(
    (existing || []).map((s: { game_date: string }) => s.game_date)
  );

  // Insert only missing dates
  const toInsert = gameDates
    .filter((date) => !existingDates.has(date))
    .map((date) => ({
      event_id: event.id,
      game_date: date,
    }));

  if (toInsert.length === 0) return 0;

  const { error } = await supabase
    .from("event_schedules")
    .insert(toInsert);

  if (error) {
    console.error("Failed to generate schedules:", error);
    throw error;
  }

  return toInsert.length;
}

/**
 * Format a Date object as YYYY-MM-DD string using local date parts.
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
