import type { EventEntry } from "../types/event";
import type { EventStatus } from "./eventStatusStorage";
import type { Night } from "../types/Night";

export type HomeRecommendation = {
  event: EventEntry;
  reason: string;
};

type EventStatuses = Record<string, EventStatus>;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getHomeRecommendations(
  nights: Night[],
  events: EventEntry[],
  statuses: EventStatuses,
  now = new Date(),
  limit = 3,
  city: string | null = null,
): HomeRecommendation[] {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const attendedEventIds = new Set(
    Object.entries(statuses)
      .filter(([, status]) => status === "attended")
      .map(([eventId]) => eventId),
  );
  const attendedGenres = new Set<string>();
  const highlyRatedCities = new Set<string>();
  const highlyRatedVenues = new Set<string>();
  const seenArtists = new Set<string>();

  for (const night of nights) {
    if (night.sourceEventId) attendedEventIds.add(night.sourceEventId);
    if (night.rating >= 4) {
      highlyRatedCities.add(normalize(night.city));
      highlyRatedVenues.add(normalize(night.venueName));
    }
    for (const artist of night.artistsSeen) {
      const normalizedArtist = normalize(artist);
      if (normalizedArtist) seenArtists.add(normalizedArtist);
    }
  }

  for (const eventId of attendedEventIds) {
    const attendedEvent = eventById.get(eventId);
    attendedEvent?.genres.forEach((genre) => attendedGenres.add(normalize(genre)));
  }

  for (const event of events) {
    if (event.artists.some((artist) => seenArtists.has(normalize(artist)))) {
      event.genres.forEach((genre) => attendedGenres.add(normalize(genre)));
    }
  }

  const today = localDateKey(now);
  return events
    .filter((event) => event.date >= today && !attendedEventIds.has(event.id)
      && (!city || normalize(event.city) === normalize(city)))
    .map((event) => {
      const matchedGenres = event.genres.filter((genre) => attendedGenres.has(normalize(genre)));
      const cityMatch = highlyRatedCities.has(normalize(event.city));
      const venueMatch = highlyRatedVenues.has(normalize(event.venueName));
      const score = matchedGenres.length * 4 + (venueMatch ? 5 : 0) + (cityMatch ? 2 : 0);
      const reasonParts: string[] = [];
      if (matchedGenres.length > 0) reasonParts.push(`Genres you saw: ${matchedGenres.slice(0, 2).join(", ")}`);
      if (venueMatch) reasonParts.push("A venue you rated highly");
      if (cityMatch) reasonParts.push("A city you explored");

      return {
        event,
        score,
        reason: reasonParts.length > 0 ? reasonParts.join(" · ") : "Upcoming event in Discovery",
      };
    })
    .sort((first, second) => second.score - first.score
      || first.event.date.localeCompare(second.event.date)
      || first.event.startTime.localeCompare(second.event.startTime))
    .slice(0, Math.max(0, limit))
    .map(({ event, reason }) => ({ event, reason }));
}
