import type { EventEntry } from "../types/event";

export type CalendarEventDetails = {
  title: string;
  location: string;
  startDate: Date;
  endDate: Date;
  notes: string;
  timeZone?: string;
  alarmOffsetMinutes: number;
};

export const CALENDAR_ALARM_OFFSET_MINUTES = -120;
export const CALENDAR_NOTES_TAGLINE = "Added from RaveOrb";
const DEFAULT_DURATION_HOURS = 5;
const CANCELLED_PREFIX = "CANCELLED: ";

function wallTimeAsUtcMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour) % 24, Number(values.minute), Number(values.second));
}

function parseDateTime(date: string, time: string): number[] | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return null;
  return [Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]),
    Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3] ?? 0)];
}

/**
 * Converts a wall-clock date and time in the given IANA timezone to a UTC Date.
 * Falls back to the device timezone when `timeZone` is empty or unknown.
 */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  const parts = parseDateTime(date, time);
  if (!parts) return null;
  const [year, month, day, hour, minute, second] = parts;
  let result: Date;
  try {
    // Find the instant whose wall time in `timeZone` matches the requested one;
    // two rounds converge across DST transitions.
    const desired = Date.UTC(year, month, day, hour, minute, second);
    let guess = desired;
    for (let round = 0; round < 2; round += 1) {
      guess = desired - (wallTimeAsUtcMs(guess, timeZone) - guess);
    }
    result = new Date(guess);
  } catch {
    result = new Date(year, month, day, hour, minute, second);
  }
  return Number.isFinite(result.getTime()) ? result : null;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function nextDay(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

export function buildCalendarEventDetails(event: EventEntry): CalendarEventDetails | null {
  const startDate = zonedDateTimeToUtc(event.date, event.startTime, event.timezone);
  if (!startDate) return null;

  let endDate: Date | null = null;
  if (event.endTime?.trim()) {
    endDate = zonedDateTimeToUtc(event.date, event.endTime, event.timezone);
    // An end at or before the start means the event runs past midnight.
    if (endDate && endDate.getTime() <= startDate.getTime()) {
      endDate = zonedDateTimeToUtc(nextDay(event.date), event.endTime, event.timezone);
    }
  }
  if (!endDate) endDate = new Date(startDate.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);

  const location = [event.venueName, event.address].filter((value) => value?.trim()).join(", ")
    || [event.city, event.countryCode].filter((value) => value?.trim()).join(", ");
  const url = event.ticketUrl?.trim() || event.eventUrl?.trim();
  const notes = url ? `${url}\n\n${CALENDAR_NOTES_TAGLINE}` : CALENDAR_NOTES_TAGLINE;

  return {
    title: event.title,
    location,
    startDate,
    endDate,
    notes,
    ...(event.timezone && isValidTimeZone(event.timezone) ? { timeZone: event.timezone } : {}),
    alarmOffsetMinutes: CALENDAR_ALARM_OFFSET_MINUTES,
  };
}

export function cancelledCalendarTitle(title: string): string {
  return title.startsWith(CANCELLED_PREFIX) ? title : `${CANCELLED_PREFIX}${title}`;
}
