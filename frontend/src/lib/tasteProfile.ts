import { lineupArtistNames } from "./artistMatching";
import type { Night } from "../types/Night";
import type { EventEntry, RaveOrbCategory } from "../types/event";

type Evidence = { rating: number; date: string; venue: string };
export type TasteEntry = { score: number; label: string; followed?: boolean; favourite?: boolean; evidence?: Evidence };
export type TasteProfile = {
  artists: Map<string, TasteEntry>;
  venues: Map<string, TasteEntry>;
  categories: Map<RaveOrbCategory, TasteEntry>;
  coldStart: boolean;
};

export function normalizeVenueName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

function ratingWeight(rating: number): number {
  if (rating === 5) return 5;
  if (rating === 4) return 3;
  if (rating === 3) return 1;
  if (rating === 1 || rating === 2) return -2;
  return 0;
}

function cutoffKey(now: Date): string {
  const year = now.getFullYear() - 1;
  const month = now.getMonth();
  const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function add<K>(entries: Map<K, TasteEntry>, key: K, label: string, weight: number, evidence?: Evidence) {
  const entry = entries.get(key) ?? { score: 0, label };
  entry.score += weight;
  if (evidence && evidence.rating >= 3 && (!entry.evidence || evidence.rating > entry.evidence.rating
    || (evidence.rating === entry.evidence.rating && evidence.date > entry.evidence.date))) entry.evidence = evidence;
  entries.set(key, entry);
}

export function buildTasteProfile(
  nights: Night[],
  followedArtists: ReadonlyMap<string, string>,
  preferences: { favouriteCategories: readonly RaveOrbCategory[] },
  linkedEvents: EventEntry[],
  now = new Date(),
): TasteProfile {
  const artists = new Map<string, TasteEntry>();
  const venues = new Map<string, TasteEntry>();
  const categories = new Map<RaveOrbCategory, TasteEntry>();
  const eventById = new Map(linkedEvents.map((event) => [event.id, event]));
  const cutoff = cutoffKey(now);

  for (const night of nights) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night.date)) continue;
    const parsedDate = new Date(`${night.date}T12:00:00Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== night.date) continue;
    const weight = ratingWeight(night.rating) * (night.date < cutoff ? 0.5 : 1);
    if (!weight) continue;
    const evidence = { rating: night.rating, date: night.date, venue: night.venueName.trim() };
    for (const artist of lineupArtistNames(night.artistsSeen)) add(artists, artist.key, artist.name, weight, evidence);
    const venue = normalizeVenueName(night.venueName);
    if (venue) add(venues, venue, night.venueName.trim(), weight / 2, evidence);
    const category = night.sourceEventId ? eventById.get(night.sourceEventId)?.raveOrbCategory : undefined;
    if (category) add(categories, category, category, weight, evidence);
  }
  for (const artist of lineupArtistNames([...followedArtists.values()])) {
    add(artists, artist.key, artist.name, 6);
    artists.get(artist.key)!.followed = true;
  }
  for (const category of new Set(preferences.favouriteCategories)) {
    add(categories, category, category, 4);
    categories.get(category)!.favourite = true;
  }
  return { artists, venues, categories, coldStart: nights.length === 0 && followedArtists.size === 0 && preferences.favouriteCategories.length === 0 };
}
