import { zonedDateTimeToUtc } from "./calendarEventDetails";
import { getBeaconDevOverrides } from "./beaconDevOverrides";
import type { EventEntry } from "../types/event";

export type SetTime = { artist: string; time: string };
type Schedule = Pick<EventEntry, "date" | "startTime" | "endTime" | "timezone" | "dateTime">;
const HOUR = 60 * 60 * 1000;

function validDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function eventInstant(date: string, time: string, timezone: string, dateTime?: string): Date | null {
  if (!validDate(date) || !timezone.trim() || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return null;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    const matchesWallTime = (instant: Date) => {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
      return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
        === `${date} ${time.length === 5 ? `${time}:00` : time}`;
    };
    if (dateTime && /(?:Z|[+-]\d{2}:\d{2})$/i.test(dateTime)) {
      const exact = new Date(dateTime);
      if (Number.isFinite(exact.getTime()) && matchesWallTime(exact)) return exact;
    }
    const result = zonedDateTimeToUtc(date, time, timezone);
    if (!result) return null;
    return matchesWallTime(result) ? result : null;
  } catch {
    return null;
  }
}

export function getBeaconStart(event: Schedule): Date | null {
  return eventInstant(event.date, event.startTime, event.timezone, event.dateTime);
}

export function isBeaconWindow(event: Schedule, now = new Date()): boolean {
  if (getBeaconDevOverrides().forceWindow) return true;
  const start = getBeaconStart(event);
  if (!start) return false;
  const difference = now.getTime() - start.getTime();
  return difference >= -6 * HOUR && difference <= 12 * HOUR;
}

export function isAfterEvent(event: Schedule, now = new Date()): boolean {
  if (getBeaconDevOverrides().forceAfterEvent) return true;
  const start = getBeaconStart(event);
  if (!start) return false;
  if (!event.endTime.trim()) return now.getTime() >= start.getTime() + 5 * HOUR;
  let end = eventInstant(event.date, event.endTime, event.timezone);
  if (!end) return false;
  if (end.getTime() <= start.getTime()) {
    const next = new Date(`${event.date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    end = eventInstant(next.toISOString().slice(0, 10), event.endTime, event.timezone);
  }
  return end !== null && now.getTime() >= end.getTime();
}

export function buildPlanMessage(event: Pick<EventEntry, "title" | "venueName" | "address" | "city">, homeBy: string, location?: { latitude: number; longitude: number }): string {
  const lines = [
    `Event: ${event.title}`,
    `Venue: ${event.venueName || "Not available"}`,
    `Address: ${event.address || "Not available"}${event.city ? `, ${event.city}` : ""}`,
    `I'll text you when I'm home by ${homeBy.trim()}.`,
  ];
  if (location) lines.push(`My current location: https://www.google.com/maps/search/?api=1&query=${location.latitude}%2C${location.longitude}`);
  return lines.join("\n");
}

export function nightPrefill(event: Pick<EventEntry, "id" | "sourceEventId" | "title" | "venueName" | "city" | "date" | "artists">, sets: SetTime[]) {
  const artists = sets.map((set) => set.artist.trim()).filter(Boolean);
  return {
    sourceEventId: event.sourceEventId ?? event.id,
    eventName: event.title,
    venueName: event.venueName,
    city: event.city,
    date: event.date,
    artists: (artists.length ? artists : event.artists).join("|"),
  };
}