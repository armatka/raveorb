import { EventEntry } from "../types/index.js";

export function getStats(events: EventEntry[]) {
  const cities = new Set(events.map((event) => event.city));
  const venues = new Set(events.map((event) => event.venueId));
  const genreCounts = events.reduce<Record<string, number>>((counts, event) => {
    for (const genre of event.genres) {
      counts[genre] = (counts[genre] ?? 0) + 1;
    }
    return counts;
  }, {});
  const topGenre = Object.entries(genreCounts).sort((first, second) => second[1] - first[1])[0]?.[0] ?? "none";

  return {
    totalEvents: events.length,
    totalCities: cities.size,
    totalVenues: venues.size,
    totalGenres: Object.keys(genreCounts).length,
    topGenre,
  };
}
