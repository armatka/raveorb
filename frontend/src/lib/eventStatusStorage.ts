import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EventEntry } from "../types/event";
import { acknowledgeChange, isEventUpcoming, snapshotEvent, type EventChangeKind, type EventSnapshot } from "./eventChanges";

export type EventStatus = "interested" | "going" | "attended";
export type TrackedEvent = { status: EventStatus; snapshot?: EventSnapshot; latest?: EventSnapshot };
type StatusData = { version: 2; entries: Record<string, TrackedEvent>; lastRefresh?: number; cursor: number };
type EventStatusMap = Record<string, EventStatus>;

const STORAGE_KEY = "raveorb.event-statuses.v1";
const refreshIntervalMs = 6 * 60 * 60 * 1000;
let writeQueue: Promise<void> = Promise.resolve();

function isEventStatus(value: unknown): value is EventStatus {
  return value === "interested" || value === "going" || value === "attended";
}

function isSnapshot(value: unknown): value is EventSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return ["title", "date", "startTime", "venueName", "city", "timezone"].every((key) => typeof item[key] === "string")
    && (item.sourceEventId === undefined || typeof item.sourceEventId === "string")
    && (item.artists === undefined || (Array.isArray(item.artists) && item.artists.every((artist: unknown) => typeof artist === "string")))
    && (item.status === undefined || ["scheduled", "cancelled", "postponed", "rescheduled", "sold-out"].includes(String(item.status)));
}

async function readAll(): Promise<StatusData> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return { version: 2, entries: {}, cursor: 0 };
  let parsed: unknown;
  try { parsed = JSON.parse(stored); } catch { throw new Error("Event statuses could not be read."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Event statuses contain unsupported records.");
  const data = parsed as Record<string, unknown>;
  if (data.version === 2) {
    if (!data.entries || typeof data.entries !== "object" || Array.isArray(data.entries)
      || !Number.isInteger(data.cursor) || Number(data.cursor) < 0
      || (data.lastRefresh !== undefined && (typeof data.lastRefresh !== "number" || !Number.isFinite(data.lastRefresh)))) {
      throw new Error("Event statuses contain unsupported records.");
    }
    for (const value of Object.values(data.entries)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Event statuses contain unsupported records.");
      const entry = value as Record<string, unknown>;
      if (!isEventStatus(entry.status) || (entry.snapshot !== undefined && !isSnapshot(entry.snapshot))
        || (entry.latest !== undefined && !isSnapshot(entry.latest))) throw new Error("Event statuses contain unsupported records.");
    }
    return parsed as StatusData;
  }
  if (!Object.values(data).every(isEventStatus)) throw new Error("Event statuses contain unsupported records.");
  return { version: 2, entries: Object.fromEntries(Object.entries(data).map(([id, status]) => [id, { status: status as EventStatus }])), cursor: 0 };
}

function updateAll<T>(update: (data: StatusData) => { data: StatusData; result: T }): Promise<T> {
  const write = writeQueue.then(async () => {
    const current = await readAll();
    const { data, result } = update(current);
    if (data !== current) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return result;
  });
  writeQueue = write.then(() => undefined, () => undefined);
  return write;
}

export const eventStatusStorage = {
  async list(): Promise<EventStatusMap> {
    return Object.fromEntries(Object.entries((await readAll()).entries).map(([id, entry]) => [id, entry.status]));
  },
  async listTracked(): Promise<Record<string, TrackedEvent>> {
    return (await readAll()).entries;
  },
  async get(eventId: string): Promise<EventStatus | null> {
    return (await readAll()).entries[eventId]?.status ?? null;
  },
  async set(eventId: string, status: EventStatus | null, event?: EventEntry): Promise<void> {
    await updateAll((data) => {
      const entries = { ...data.entries };
      if (status === null) delete entries[eventId];
      else {
        const previous = entries[eventId];
        const snapshot = previous?.snapshot
          ? event ? enrichSnapshot(previous.snapshot, event) : previous.snapshot
          : event ? snapshotEvent(event) : undefined;
        entries[eventId] = { ...previous, status, ...(snapshot ? { snapshot } : {}) };
      }
      return { data: { ...data, entries }, result: undefined };
    });
  },
  async remove(eventId: string): Promise<void> {
    await this.set(eventId, null);
  },
  async backfillSnapshots(events: EventEntry[]): Promise<void> {
    await updateAll((data) => {
      const entries = { ...data.entries };
      let changed = false;
      for (const event of events) {
        const entry = entries[event.id];
        if (entry && (!entry.snapshot || !entry.snapshot.sourceEventId || !entry.snapshot.artists)) {
          entries[event.id] = { ...entry, snapshot: entry.snapshot ? enrichSnapshot(entry.snapshot, event) : snapshotEvent(event) };
          changed = true;
        }
      }
      return { data: changed ? { ...data, entries } : data, result: undefined };
    });
  },
  async reserveRefresh(now = new Date(), skipIds: ReadonlySet<string> = new Set()): Promise<string[]> {
    return updateAll((data) => {
      const timestamp = now.getTime();
      if (data.lastRefresh !== undefined && timestamp - data.lastRefresh < refreshIntervalMs) return { data, result: [] };
      const ids = Object.entries(data.entries).filter(([id, entry]) =>
        (entry.status === "going" || entry.status === "interested")
        && !skipIds.has(id) && entry.snapshot && isEventUpcoming(entry.snapshot, now)
        && (!entry.latest || isEventUpcoming(entry.latest, now))).map(([id]) => id).sort();
      if (!ids.length) return { data, result: [] };
      const start = data.cursor % ids.length;
      const batch = [...ids.slice(start), ...ids.slice(0, start)].slice(0, 25);
      return { data: { ...data, lastRefresh: timestamp, cursor: (start + batch.length) % ids.length }, result: batch };
    });
  },
  async recordLatest(eventId: string, event: EventEntry): Promise<void> {
    await updateAll((data) => {
      const entry = data.entries[eventId];
      if (!entry || !entry.snapshot || (entry.status !== "going" && entry.status !== "interested")) return { data, result: undefined };
      return { data: { ...data, entries: { ...data.entries, [eventId]: { ...entry, snapshot: enrichSnapshot(entry.snapshot, event), latest: snapshotEvent(event) } } }, result: undefined };
    });
  },
  async dismiss(eventId: string, kind: EventChangeKind): Promise<void> {
    await updateAll((data) => {
      const entry = data.entries[eventId];
      if (!entry?.snapshot || !entry.latest) return { data, result: undefined };
      return { data: { ...data, entries: { ...data.entries, [eventId]: { ...entry, snapshot: acknowledgeChange(entry.snapshot, entry.latest, kind) } } }, result: undefined };
    });
  },
};

function enrichSnapshot(snapshot: EventSnapshot, event: EventEntry): EventSnapshot {
  return {
    ...snapshot,
    sourceEventId: snapshot.sourceEventId || event.sourceEventId?.trim() || event.id,
    artists: snapshot.artists ?? event.artists,
  };
}
