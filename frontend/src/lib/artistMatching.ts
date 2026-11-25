import { normalizeArtistName, splitLineupNames } from "./artistResolver";
import type { EventEntry } from "../types/event";
import type { Night } from "../types/Night";

export type FollowSource = "manual" | "suggested";
export type FollowedArtist = { name: string; normalizedName: string; followedAt: string; source: FollowSource };
export type ArtistAlert = {
  eventId: string;
  title: string;
  date: string;
  startTime: string;
  venueName: string;
  city: string;
  artistNames: string[];
  artistKeys: string[];
  foundAt: string;
  seenAt?: string;
};
export type FollowSuggestion = { name: string; normalizedName: string; nightCount: number; bestRating: number; reason: string };

export function lineupArtistNames(names: string[]): Array<{ name: string; key: string }> {
  const seen = new Map<string, string>();
  for (const name of names) {
    for (const part of splitLineupNames(name)) {
      const key = normalizeArtistName(part);
      if (key && !seen.has(key)) seen.set(key, part);
    }
  }
  return [...seen].map(([key, name]) => ({ name, key }));
}

export function eventArtistKeys(event: Pick<EventEntry, "artists">): Set<string> {
  return new Set(lineupArtistNames(event.artists).map(({ key }) => key));
}

export function matchFollowedArtists(event: Pick<EventEntry, "artists">, followedKeys: ReadonlySet<string>): string[] {
  return [...eventArtistKeys(event)].filter((key) => followedKeys.has(key));
}

export function getFollowSuggestions(nights: Night[], followedKeys: ReadonlySet<string>): FollowSuggestion[] {
  const stats = new Map<string, { name: string; latest: string; nights: Set<string>; bestRating: number }>();
  for (const night of nights) {
    const rating = Number.isFinite(night.rating) ? night.rating : 0;
    for (const { name, key } of lineupArtistNames(night.artistsSeen)) {
      if (followedKeys.has(key)) continue;
      const current = stats.get(key) ?? { name, latest: night.date, nights: new Set<string>(), bestRating: 0 };
      current.nights.add(night.id);
      current.bestRating = Math.max(current.bestRating, rating);
      if (night.date >= current.latest) {
        current.latest = night.date;
        current.name = name;
      }
      stats.set(key, current);
    }
  }
  return [...stats].filter(([, item]) => item.nights.size >= 2 || item.bestRating >= 4)
    .map(([normalizedName, item]) => ({
      name: item.name,
      normalizedName,
      nightCount: item.nights.size,
      bestRating: item.bestRating,
      latest: item.latest,
      reason: item.nights.size >= 2 ? `Seen ${item.nights.size} times` : `At a Night you rated ${item.bestRating}`,
    }))
    .sort((first, second) => second.nightCount - first.nightCount || second.latest.localeCompare(first.latest) || first.name.localeCompare(second.name))
    .map(({ latest: _latest, ...suggestion }) => suggestion);
}

export function buildArtistAlerts(events: EventEntry[], followed: FollowedArtist[], today: string, now = new Date()): ArtistAlert[] {
  const names = new Map(followed.map((artist) => [artist.normalizedName, artist.name]));
  const alerts = new Map<string, ArtistAlert>();
  for (const event of events) {
    if (event.date < today) continue;
    const keys = matchFollowedArtists(event, new Set(names.keys()));
    if (!keys.length) continue;
    const existing = alerts.get(event.id);
    const artistKeys = [...new Set([...(existing?.artistKeys ?? []), ...keys])];
    alerts.set(event.id, {
      eventId: event.id,
      title: event.title,
      date: event.date,
      startTime: event.startTime,
      venueName: event.venueName,
      city: event.city,
      artistKeys,
      artistNames: artistKeys.map((key) => names.get(key) ?? key),
      foundAt: now.toISOString(),
    });
  }
  return [...alerts.values()];
}

export function countAlertArtists(alerts: ArtistAlert[]): number {
  return new Set(alerts.flatMap((alert) => alert.artistKeys)).size;
}
