import { EventEntry } from "../types/index.js";

export function getStats(events: EventEntry[]) {
  const totalEvents = events.length;
  const totalSpend = events.reduce((sum, event) => sum + event.spend, 0);
  const avgSpend = totalEvents ? Math.round(totalSpend / totalEvents) : 0;
  const avgHours =
    totalEvents ? events.reduce((sum, event) => sum + event.durationHours, 0) / totalEvents : 0;
  const avgVibe = totalEvents
    ? Math.round(events.reduce((sum, event) => sum + event.vibeScore, 0) / totalEvents)
    : 0;

  return {
    totalEvents,
    totalSpend,
    avgSpend,
    avgHours,
    avgVibe,
    topGenre: events[0]?.type ?? "none",
  };
}
