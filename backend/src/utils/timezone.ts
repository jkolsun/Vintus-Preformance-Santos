/**
 * Timezone-aware scheduling helpers.
 * Used by the cron service to determine client-local times.
 */

/** Get the current hour (0-23) in a given IANA timezone */
export function getCurrentHourInTimezone(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(now), 10);
}

/** Get today's date (YYYY-MM-DD) in a given IANA timezone */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/** Get the day of week (0=Sunday, 6=Saturday) in a given IANA timezone */
export function getDayOfWeekInTimezone(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const day = formatter.format(now);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[day] ?? 0;
}

/** Convert a local time string (HH:MM) + timezone to a UTC Date for today */
export function localTimeToUtc(
  timeStr: string,
  timezone: string,
  date?: Date
): Date {
  const baseDate = date ?? new Date();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const localDateStr = getTodayInTimezone(timezone);
  const isoStr = `${localDateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

  // Create a date object in the target timezone by using Intl to find the offset
  const utcDate = new Date(isoStr + "Z");
  const localInUtc = new Date(
    utcDate.toLocaleString("en-US", { timeZone: "UTC" })
  );
  const localInTz = new Date(
    utcDate.toLocaleString("en-US", { timeZone: timezone })
  );
  const offset = localInUtc.getTime() - localInTz.getTime();

  return new Date(utcDate.getTime() + offset);
}

/** Get the start of the current week (Monday 00:00) in a given timezone */
export function getWeekStartInTimezone(timezone: string): Date {
  const today = getTodayInTimezone(timezone);
  const date = new Date(today + "T00:00:00Z");
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust so Monday is start
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}
