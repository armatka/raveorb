import type { Artist } from "../types/artist";
import type { EventEntry } from "../types/event";
import type { Night } from "../types/Night";

export function normalizeArtistName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

const LINEUP_SEPARATOR = /\s+b\d+b\s+|,/i;

// Splits combined lineup entries such as "A b2b B" or "A, B"; "&" and "and" are kept because they appear in act names.
export function splitLineupNames(name: string): string[] {
  return name.split(LINEUP_SEPARATOR).map((part) => part.trim().replace(/\s+/g, " ")).filter((part) => normalizeArtistName(part));
}

function matchesArtistId(name: string, id: string): boolean {
  return artistId(name) === id || splitLineupNames(name).some((part) => artistId(part) === id);
}

export function artistId(name: string): string {
  const normalized = normalizeArtistName(name);
  return normalized ? `artist-${Array.from(normalized, (character) => character.codePointAt(0)!.toString(16)).join("-")}` : "";
}

export function resolveArtist(id: string, events: EventEntry[], nights: Night[]): Artist | null {
  let name = "";
  const genres = new Map<string, string>();
  for (const event of events) {
    const match = event.artists.find((artist) => matchesArtistId(artist, id));
    if (!match) continue;
    if (!name) name = displayName(match, id);
    for (const genre of event.genres) {
      const key = genre.trim().toLowerCase();
      if (key && !genres.has(key)) genres.set(key, genre.trim());
    }
  }
  if (!name) {
    for (const night of nights) {
      const match = night.artistsSeen.find((artist) => matchesArtistId(artist, id));
      if (match) {
        name = displayName(match, id);
        break;
      }
    }
  }
  return name ? { id, name, genres: [...genres.values()] } : null;
}

function displayName(match: string, id: string): string {
  return artistId(match) === id ? match.trim().replace(/\s+/g, " ") : splitLineupNames(match).find((part) => artistId(part) === id) ?? match.trim();
}

export function getArtistHistory(id: string, nights: Night[]) {
  const matching = nights.filter((night) => night.artistsSeen.some((artist) => matchesArtistId(artist, id)))
    .sort((first, second) => second.date.localeCompare(first.date) || second.updatedAt.localeCompare(first.updatedAt));
  const ratings = matching.map((night) => night.rating).filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const unique = (values: string[]) => [...new Map(values.filter((value) => value.trim()).map((value) => [value.trim().toLowerCase(), value.trim()])).values()];
  return {
    nights: matching,
    cities: unique(matching.map((night) => night.city)),
    venues: unique(matching.map((night) => night.venueName)),
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
  };
}

export function getArtistUpcomingEvents(id: string, events: EventEntry[], today: string): EventEntry[] {
  return events.filter((event) => event.date >= today && event.artists.some((artist) => matchesArtistId(artist, id)))
    .sort((first, second) => first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime));
}