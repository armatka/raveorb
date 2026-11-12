import type { Artist } from "../types/artist";
import type { EventEntry } from "../types/event";
import type { Night } from "../types/Night";

export function normalizeArtistName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function artistId(name: string): string {
  const normalized = normalizeArtistName(name);
  return normalized ? `artist-${Array.from(normalized, (character) => character.codePointAt(0)!.toString(16)).join("-")}` : "";
}

export function resolveArtist(id: string, events: EventEntry[], nights: Night[]): Artist | null {
  let name = "";
  const genres = new Map<string, string>();
  for (const event of events) {
    const match = event.artists.find((artist) => artistId(artist) === id);
    if (!match) continue;
    if (!name) name = match.trim().replace(/\s+/g, " ");
    for (const genre of event.genres) {
      const key = genre.trim().toLowerCase();
      if (key && !genres.has(key)) genres.set(key, genre.trim());
    }
  }
  if (!name) {
    for (const night of nights) {
      const match = night.artistsSeen.find((artist) => artistId(artist) === id);
      if (match) {
        name = match.trim().replace(/\s+/g, " ");
        break;
      }
    }
  }
  return name ? { id, name, genres: [...genres.values()] } : null;
}

export function getArtistHistory(id: string, nights: Night[]) {
  const matching = nights.filter((night) => night.artistsSeen.some((artist) => artistId(artist) === id))
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
  return events.filter((event) => event.date >= today && event.artists.some((artist) => artistId(artist) === id))
    .sort((first, second) => first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime));
}