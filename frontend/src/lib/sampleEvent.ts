import AsyncStorage from "@react-native-async-storage/async-storage";

import type { EventEntry } from "../types/event";

// Preserve existing sample IDs referenced by saved statuses and journal entries.
export const SAMPLE_EVENT_ID_PREFIX = "raveorb-local-sample-night-of-";
const STORAGE_KEY = "raveorb.sample-event.v1";
const TIMEZONE = "America/Toronto";

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function createSampleEvent(now = new Date()): EventEntry {
  const start = new Date(Math.ceil(now.getTime() / 60000) * 60000 + 2 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 5 * 60 * 60 * 1000);
  const startParts = localParts(start);
  const endParts = localParts(end);
  return {
    id: `${SAMPLE_EVENT_ID_PREFIX}${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    title: "[Sample] Tonight's Signal",
    type: "club",
    venueId: "sample-venue",
    venueName: "The Lantern",
    address: "123 Sample Street",
    city: "Toronto",
    countryCode: "CA",
    date: `${startParts.year}-${startParts.month}-${startParts.day}`,
    dateTime: start.toISOString(),
    startTime: `${startParts.hour}:${startParts.minute}`,
    endTime: `${endParts.hour}:${endParts.minute}`,
    timezone: TIMEZONE,
    artists: ["Nova Echo", "Glass Current"],
    genres: ["techno"],
    description: "A fictional local event for testing Beacon.",
    source: "raveorb-local-sample",
    status: "scheduled",
  };
}

export const sampleEventStorage = {
  async get(): Promise<({ id: string } & Record<string, unknown>) | null> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    let value: unknown;
    try { value = JSON.parse(stored); } catch { throw new Error("Sample event could not be read."); }
    if (!value || typeof value !== "object" || Array.isArray(value) || !("id" in value)
      || typeof value.id !== "string" || !value.id.startsWith(SAMPLE_EVENT_ID_PREFIX)) {
      throw new Error("Sample event contains unsupported data.");
    }
    return value as { id: string } & Record<string, unknown>;
  },
  async set(event: EventEntry): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  },
  async remove(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
