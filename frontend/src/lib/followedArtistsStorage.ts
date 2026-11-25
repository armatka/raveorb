import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ArtistAlert, FollowedArtist, FollowSource } from "./artistMatching";
import { normalizeArtistName, splitLineupNames } from "./artistResolver";

export const ALERT_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const ALERT_ARTISTS_PER_REFRESH = 10;

type AlertState = { lastCheck?: number; locationKey?: string; cursor: number; retry: string[]; items: Record<string, ArtistAlert> };
type FollowedData = { version: 1; artists: FollowedArtist[]; alerts: AlertState };

const STORAGE_KEY = "raveorb.followed-artists.v1";
let writeQueue: Promise<void> = Promise.resolve();

function emptyData(): FollowedData {
  return { version: 1, artists: [], alerts: { cursor: 0, retry: [], items: {} } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseArtists(value: unknown): FollowedArtist[] {
  if (!Array.isArray(value)) return [];
  const byKey = new Map<string, FollowedArtist>();
  for (const item of value) {
    if (!isRecord(item) || !isString(item.name) || !isString(item.followedAt) || !Number.isFinite(Date.parse(item.followedAt))) continue;
    const name = item.name.trim().replace(/\s+/g, " ");
    const normalizedName = normalizeArtistName(name);
    if (!normalizedName) continue;
    const source: FollowSource = item.source === "suggested" ? "suggested" : "manual";
    const existing = byKey.get(normalizedName);
    if (!existing || item.followedAt < existing.followedAt) byKey.set(normalizedName, { name, normalizedName, followedAt: item.followedAt, source });
  }
  return [...byKey.values()].sort((first, second) => first.followedAt.localeCompare(second.followedAt) || first.normalizedName.localeCompare(second.normalizedName));
}

function parseAlert(value: unknown): ArtistAlert | null {
  if (!isRecord(value)) return null;
  const { eventId, title, date, startTime, venueName, city, foundAt, seenAt, artistNames, artistKeys } = value;
  if (![eventId, title, date, venueName, city, foundAt].every(isString) || !/^\d{4}-\d{2}-\d{2}$/.test(date as string)
    || !Array.isArray(artistKeys) || !artistKeys.every(isString) || !Array.isArray(artistNames) || !artistNames.every(isString)
    || (seenAt !== undefined && !isString(seenAt))) return null;
  return {
    eventId: eventId as string, title: title as string, date: date as string, startTime: isString(startTime) ? startTime : "",
    venueName: venueName as string, city: city as string, foundAt: foundAt as string,
    artistKeys: artistKeys.map(normalizeArtistName), artistNames, ...(seenAt ? { seenAt } : {}),
  };
}

function parseAlerts(value: unknown): AlertState {
  if (!isRecord(value)) return emptyData().alerts;
  const items: Record<string, ArtistAlert> = {};
  if (isRecord(value.items)) {
    for (const [id, item] of Object.entries(value.items)) {
      const alert = parseAlert(item);
      if (alert && alert.eventId === id) items[id] = alert;
    }
  }
  return {
    ...(typeof value.lastCheck === "number" && Number.isFinite(value.lastCheck) ? { lastCheck: value.lastCheck } : {}),
    ...(isString(value.locationKey) ? { locationKey: value.locationKey } : {}),
    cursor: Number.isInteger(value.cursor) && (value.cursor as number) >= 0 ? value.cursor as number : 0,
    retry: Array.isArray(value.retry) ? [...new Set(value.retry.filter(isString).map(normalizeArtistName).filter(Boolean))] : [],
    items,
  };
}

async function read(): Promise<FollowedData> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === null) return emptyData();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error("Followed artists could not be read.");
  }
  if (!isRecord(parsed) || parsed.version !== 1) throw new Error("Followed artists use an unsupported format.");
  return { version: 1, artists: parseArtists(parsed.artists), alerts: parseAlerts(parsed.alerts) };
}

function update<T>(change: (data: FollowedData) => { data: FollowedData; result: T }): Promise<T> {
  const write = writeQueue.then(async () => {
    const { data, result } = change(await read());
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return result;
  });
  writeQueue = write.then(() => undefined, () => undefined);
  return write;
}

function pruneAlerts(items: Record<string, ArtistAlert>, now: Date): Record<string, ArtistAlert> {
  const today = dateKey(now);
  return Object.fromEntries(Object.entries(items).filter(([, alert]) => alert.date >= today));
}

function lineupKeys(name: string): Array<{ name: string; key: string }> {
  return splitLineupNames(name).map((part) => ({ name: part, key: normalizeArtistName(part) })).filter(({ key }) => key);
}

export const followedArtistsStorage = {
  async list(): Promise<FollowedArtist[]> {
    await writeQueue;
    return (await read()).artists;
  },

  async followedKeys(): Promise<Set<string>> {
    return new Set((await this.list()).map((artist) => artist.normalizedName));
  },

  follow(name: string, source: FollowSource = "manual", now = new Date()): Promise<void> {
    const parts = lineupKeys(name);
    if (!parts.length) return Promise.reject(new Error("Artist name is required."));
    return update((data) => {
      const existing = new Set(data.artists.map((artist) => artist.normalizedName));
      const added = parts.filter(({ key }) => !existing.has(key))
        .map(({ name: partName, key }) => ({ name: partName, normalizedName: key, followedAt: now.toISOString(), source }));
      return { data: { ...data, artists: [...data.artists, ...added] }, result: undefined };
    });
  },

  unfollow(name: string): Promise<void> {
    const keys = new Set(lineupKeys(name).map(({ key }) => key));
    return update((data) => ({
      data: {
        ...data,
        artists: data.artists.filter((artist) => !keys.has(artist.normalizedName)),
        alerts: { ...data.alerts, retry: data.alerts.retry.filter((key) => !keys.has(key)) },
      },
      result: undefined,
    }));
  },

  /** Reserves the next batch of followed artists to search, at most once per window per location. */
  reserveAlertCheck(locationKey: string, now = new Date()): Promise<FollowedArtist[]> {
    return update((data) => {
      const { alerts, artists } = data;
      const sameLocation = alerts.locationKey === locationKey;
      if (!artists.length || (sameLocation && alerts.lastCheck !== undefined && now.getTime() - alerts.lastCheck < ALERT_REFRESH_INTERVAL_MS)) {
        return { data, result: [] };
      }
      const byKey = new Map(artists.map((artist) => [artist.normalizedName, artist]));
      const batch = (sameLocation ? alerts.retry : []).map((key) => byKey.get(key)).filter((artist): artist is FollowedArtist => Boolean(artist))
        .slice(0, ALERT_ARTISTS_PER_REFRESH);
      const start = alerts.cursor % artists.length;
      let taken = 0;
      while (batch.length < ALERT_ARTISTS_PER_REFRESH && taken < artists.length) {
        const artist = artists[(start + taken) % artists.length];
        taken += 1;
        if (!batch.includes(artist)) batch.push(artist);
      }
      return {
        data: { ...data, alerts: { ...alerts, lastCheck: now.getTime(), locationKey, cursor: (start + taken) % artists.length, retry: [] } },
        result: batch,
      };
    });
  },

  recordAlertResults(found: ArtistAlert[], failedKeys: string[], now = new Date()): Promise<void> {
    return update((data) => {
      const followed = new Set(data.artists.map((artist) => artist.normalizedName));
      const items = pruneAlerts(data.alerts.items, now);
      const today = dateKey(now);
      for (const alert of found) {
        if (alert.date < today) continue;
        const existing = items[alert.eventId];
        if (!existing) {
          items[alert.eventId] = alert;
          continue;
        }
        const names = new Map(existing.artistKeys.map((key, index) => [key, existing.artistNames[index] ?? key]));
        alert.artistKeys.forEach((key, index) => { if (!names.has(key)) names.set(key, alert.artistNames[index] ?? key); });
        // Keep seenAt so an already announced event is never announced again.
        items[alert.eventId] = { ...existing, title: alert.title, date: alert.date, startTime: alert.startTime, venueName: alert.venueName, city: alert.city, artistKeys: [...names.keys()], artistNames: [...names.values()] };
      }
      const retry = [...new Set([...data.alerts.retry, ...failedKeys.map(normalizeArtistName)])].filter((key) => followed.has(key));
      return { data: { ...data, alerts: { ...data.alerts, retry, items } }, result: undefined };
    });
  },

  async listAlerts(now = new Date()): Promise<ArtistAlert[]> {
    await writeQueue;
    const data = await read();
    const followed = new Set(data.artists.map((artist) => artist.normalizedName));
    return Object.values(pruneAlerts(data.alerts.items, now)).flatMap((alert) => {
      const indexes = alert.artistKeys.map((key, index) => (followed.has(key) ? index : -1)).filter((index) => index >= 0);
      if (!indexes.length) return [];
      return [{ ...alert, artistKeys: indexes.map((index) => alert.artistKeys[index]), artistNames: indexes.map((index) => alert.artistNames[index] ?? alert.artistKeys[index]) }];
    }).sort((first, second) => first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime));
  },

  markAlertsSeen(eventIds: string[], now = new Date()): Promise<void> {
    const ids = new Set(eventIds);
    return update((data) => {
      const items = pruneAlerts(data.alerts.items, now);
      for (const id of ids) if (items[id] && !items[id].seenAt) items[id] = { ...items[id], seenAt: now.toISOString() };
      return { data: { ...data, alerts: { ...data.alerts, items } }, result: undefined };
    });
  },
};
