import { buildArtistAlerts, eventArtistKeys, type ArtistAlert, type FollowedArtist } from "../lib/artistMatching";
import { DEFAULT_DISCOVERY_LOCATION, discoveryEventsQuery, loadDiscoverySettings, type DiscoveryRadiusKm } from "../lib/discoveryLocation";
import { followedArtistsStorage } from "../lib/followedArtistsStorage";
import type { DiscoveryLocation, EventEntry } from "../types/event";
import { eventsRepository } from "./eventsRepository";

export const ARTIST_SEARCH_CONCURRENCY = 3;
export const ARTIST_SEARCH_DAYS = 90;

type SearchLocation = { location: DiscoveryLocation | null; radiusKm?: DiscoveryRadiusKm };
export type FollowedArtistSearch = { events: EventEntry[]; failed: string[] };

const sessionCache = new Map<string, Promise<EventEntry[]>>();
let inFlight: Promise<void> | undefined;

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function artistAlertLocationKey({ location, radiusKm }: SearchLocation): string {
  if (!location) return "all";
  const coordinates = typeof location.latitude === "number" && typeof location.longitude === "number" ? `${location.latitude},${location.longitude}` : "";
  return [location.city, location.region ?? "", location.countryCode, coordinates, radiusKm ?? ""].join("|").toLocaleLowerCase();
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/** Keyword search for one artist; only events whose normalized lineup includes the artist count, not title-only hits. */
export async function searchArtistEvents(artist: Pick<FollowedArtist, "name" | "normalizedName">, place: SearchLocation, now = new Date()): Promise<EventEntry[]> {
  const today = dateKey(now);
  const end = dateKey(addDays(now, ARTIST_SEARCH_DAYS));
  const events = await eventsRepository.listEvents({
    ...discoveryEventsQuery(place.location, place.radiusKm),
    search: artist.name,
    startDate: today,
    endDate: end,
    // The backend compares in UTC, so widen by a day each side and trim by local date below.
    startDateTime: `${dateKey(addDays(now, -1))}T00:00:00Z`,
    endDateTime: `${dateKey(addDays(now, ARTIST_SEARCH_DAYS + 1))}T23:59:59Z`,
    size: 50,
    sort: "date,asc",
  });
  return events.filter((event) => event.date >= today && event.date <= end && eventArtistKeys(event).has(artist.normalizedName));
}

function mergeEvents(groups: EventEntry[][]): EventEntry[] {
  const byId = new Map<string, EventEntry>();
  for (const event of groups.flat()) if (!byId.has(event.id)) byId.set(event.id, event);
  return [...byId.values()].sort((first, second) => first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime));
}

/** Per-artist search for the Discovery "Following" chip, cached for the app session. */
export async function searchFollowedArtistEvents(artists: FollowedArtist[], place: SearchLocation, now = new Date()): Promise<FollowedArtistSearch> {
  const prefix = `${artistAlertLocationKey(place)}|${dateKey(now)}|`;
  const results = await mapWithConcurrency(artists, ARTIST_SEARCH_CONCURRENCY, (artist) => {
    const key = prefix + artist.normalizedName;
    let pending = sessionCache.get(key);
    if (!pending) {
      pending = searchArtistEvents(artist, place, now);
      sessionCache.set(key, pending);
      pending.catch(() => { if (sessionCache.get(key) === pending) sessionCache.delete(key); });
    }
    return pending;
  });
  return {
    events: mergeEvents(results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))),
    failed: artists.filter((_, index) => results[index].status === "rejected").map((artist) => artist.name),
  };
}

export function clearFollowedArtistSearchCache(): void {
  sessionCache.clear();
}

export async function refreshArtistAlerts(now = new Date()): Promise<void> {
  if (inFlight) return inFlight;
  const refresh = (async () => {
    const settings = await loadDiscoverySettings();
    const place = { location: settings.discoveryLocationConfigured ? settings.location : DEFAULT_DISCOVERY_LOCATION, radiusKm: settings.radiusKm };
    const artists = await followedArtistsStorage.reserveAlertCheck(artistAlertLocationKey(place), now);
    if (!artists.length) return;
    const results = await mapWithConcurrency(artists, ARTIST_SEARCH_CONCURRENCY, (artist) => searchArtistEvents(artist, place, now));
    const found = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const failed = artists.filter((_, index) => results[index].status === "rejected").map((artist) => artist.normalizedName);
    await followedArtistsStorage.recordAlertResults(buildArtistAlerts(found, artists, dateKey(now), now), failed, now);
  })();
  inFlight = refresh;
  try { await refresh; } finally { if (inFlight === refresh) inFlight = undefined; }
}

export function listArtistAlerts(now = new Date()): Promise<ArtistAlert[]> {
  return followedArtistsStorage.listAlerts(now);
}

export function unseenArtistAlerts(alerts: ArtistAlert[]): ArtistAlert[] {
  return alerts.filter((alert) => !alert.seenAt);
}
