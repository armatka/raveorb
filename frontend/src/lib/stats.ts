import { EventEntry } from "../types/event";

export function getSummaryStats(events: EventEntry[]) {
  const cities = new Set(events.map((event) => event.city));
  const venues = new Set(events.map((event) => event.venueId));
  const genres = new Set(events.flatMap((event) => event.genres));

  return {
    totalEvents: events.length,
    totalCities: cities.size,
    totalVenues: venues.size,
    totalGenres: genres.size,
  };
}

export function getTopGenres(events: EventEntry[]) {
  const genreMap = events.reduce<Record<string, number>>((acc, event) => {
    for (const genre of event.genres) {
      acc[genre] = (acc[genre] ?? 0) + 1;
    }
    return acc;
  }, {});

  return Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

export function getVenueBreakdown(events: EventEntry[]) {
  const venueMap = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.venueName] = (acc[event.venueName] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(venueMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}
