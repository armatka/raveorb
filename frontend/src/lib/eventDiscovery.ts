import type { EventEntry, EventType } from "../types/event";

export type DiscoverySectionId = "tonight" | "weekend" | "upcoming";
export type DiscoveryDateRange = "tonight" | "weekend" | "next-7-days" | "next-30-days" | "all-upcoming";
export type DiscoveryTypeFilter = "all" | EventType;

export type DiscoveryFilters = {
  city: string | null;
  genres: string[];
  type: DiscoveryTypeFilter;
  dateRange: DiscoveryDateRange;
};

export type EventSection = {
  id: DiscoverySectionId;
  title: string;
  data: EventEntry[];
};

const sectionOrder: DiscoverySectionId[] = ["tonight", "weekend", "upcoming"];
const sectionTitles: Record<DiscoverySectionId, string> = {
  tonight: "Tonight",
  weekend: "This Weekend",
  upcoming: "Upcoming",
};

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

function dayDifference(dateKey: string, today: string): number | null {
  const eventDate = new Date(`${dateKey}T12:00:00`);
  const currentDate = new Date(`${today}T12:00:00`);
  if (Number.isNaN(eventDate.getTime()) || Number.isNaN(currentDate.getTime())) return null;
  return Math.round((eventDate.getTime() - currentDate.getTime()) / 86_400_000);
}

export function getWeekendRange(now = new Date()): { start: string; end: string } {
  const daysUntilFriday = 5 - now.getDay();
  const friday = shiftDate(now, daysUntilFriday);
  const sunday = shiftDate(friday, 2);
  return { start: localDateKey(friday), end: localDateKey(sunday) };
}

export function getDiscoverySection(
  eventDate: string,
  now = new Date(),
): DiscoverySectionId | null {
  const today = localDateKey(now);
  if (eventDate < today) return null;
  if (eventDate === today) return "tonight";

  const weekend = getWeekendRange(now);
  if (eventDate > today && eventDate >= weekend.start && eventDate <= weekend.end) {
    return "weekend";
  }
  return "upcoming";
}

export function matchesDiscoveryDateRange(
  eventDate: string,
  range: DiscoveryDateRange,
  now = new Date(),
): boolean {
  const today = localDateKey(now);
  const difference = dayDifference(eventDate, today);
  if (difference === null || difference < 0) return false;

  switch (range) {
    case "tonight":
      return difference === 0;
    case "weekend": {
      const weekend = getWeekendRange(now);
      return eventDate > today && eventDate >= weekend.start && eventDate <= weekend.end;
    }
    case "next-7-days":
      return difference <= 7;
    case "next-30-days":
      return difference <= 30;
    case "all-upcoming":
      return true;
  }
}

export function filterDiscoveryEvents(
  events: EventEntry[],
  query: string,
  filters: DiscoveryFilters,
  now = new Date(),
): EventEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return events.filter((event) => {
    if (!matchesDiscoveryDateRange(event.date, "all-upcoming", now)) return false;
    if (filters.city && event.city !== filters.city) return false;
    if (filters.type !== "all" && event.type !== filters.type) return false;
    if (filters.genres.length > 0 && !filters.genres.some((genre) => event.genres.includes(genre))) return false;
    if (!matchesDiscoveryDateRange(event.date, filters.dateRange, now)) return false;
    if (!normalizedQuery) return true;

    const searchable = [
      event.title,
      event.venueName,
      event.city,
      ...event.artists,
      ...event.genres,
    ].join(" ").toLocaleLowerCase();

    return searchable.includes(normalizedQuery);
  });
}

export function groupDiscoveryEvents(events: EventEntry[], now = new Date()): EventSection[] {
  const grouped: Record<DiscoverySectionId, EventEntry[]> = {
    tonight: [],
    weekend: [],
    upcoming: [],
  };

  for (const event of events) {
    const section = getDiscoverySection(event.date, now);
    if (section) grouped[section].push(event);
  }

  return sectionOrder
    .filter((id) => grouped[id].length > 0)
    .map((id) => ({
      id,
      title: sectionTitles[id],
      data: grouped[id].sort((first, second) => first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime)),
    }));
}
