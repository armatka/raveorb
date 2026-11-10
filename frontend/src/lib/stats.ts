import { EventEntry } from "../types/event";

export function getSummaryStats(events: EventEntry[]) {
  const totalEvents = events.length;
  const totalSpend = events.reduce((sum, event) => sum + event.spend, 0);
  const avgSpend = totalEvents ? Math.round(totalSpend / totalEvents) : 0;
  const avgHours =
    totalEvents ? events.reduce((sum, event) => sum + event.durationHours, 0) / totalEvents : 0;
  const avgVibe =
    totalEvents ? Math.round(events.reduce((sum, event) => sum + event.vibeScore, 0) / totalEvents) : 0;

  const venueCounts = events.reduce<Record<string, number>>((acc, event) => {
    const key = event.title;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const topVenue = Object.entries(venueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

  return {
    totalEvents,
    totalSpend,
    avgSpend,
    avgHours,
    avgVibe,
    topVenue,
  };
}

export function getTopGenres(events: EventEntry[]) {
  const genreMap = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

export function getVenueBreakdown(events: EventEntry[]) {
  const venueMap = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.title] = (acc[event.title] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(venueMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}
