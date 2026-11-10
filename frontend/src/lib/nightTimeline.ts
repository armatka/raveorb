import type { Night } from "../types/Night";

export type NightRatingFilter = "all" | "rated" | number;

export type NightFilters = {
  year: string | null;
  city: string | null;
  venue: string | null;
  artist: string | null;
  friend: string | null;
  rating: NightRatingFilter;
};

export type NightFilterOptions = {
  years: string[];
  cities: string[];
  venues: string[];
  artists: string[];
  friends: string[];
  ratings: number[];
};

export type NightTimelineSection = {
  key: string;
  year: string;
  month: number;
  monthLabel: string;
  startsYear: boolean;
  data: Night[];
};

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });

function monthValue(night: Night): number {
  const match = /^(\d{4})-(\d{2})/.exec(night.date);
  return match ? Number(match[2]) : 0;
}

function nightYear(night: Night): string {
  const match = /^(\d{4})-/.exec(night.date);
  return match?.[1] ?? "Undated";
}

export function getNightFilterOptions(nights: Night[]): NightFilterOptions {
  const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))]
    .sort((first, second) => first.localeCompare(second));

  return {
    years: [...new Set(nights.map(nightYear))].sort((first, second) => second.localeCompare(first)),
    cities: uniqueSorted(nights.map((night) => night.city)),
    venues: uniqueSorted(nights.map((night) => night.venueName)),
    artists: uniqueSorted(nights.flatMap((night) => night.artistsSeen)),
    friends: uniqueSorted(nights.flatMap((night) => night.friends)),
    ratings: [...new Set(nights.map((night) => night.rating).filter((value) => value > 0))].sort((a, b) => b - a),
  };
}

export function filterNights(nights: Night[], query: string, filters: NightFilters): Night[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return nights.filter((night) => {
    if (filters.year && nightYear(night) !== filters.year) return false;
    if (filters.city && night.city !== filters.city) return false;
    if (filters.venue && night.venueName !== filters.venue) return false;
    if (filters.artist && !night.artistsSeen.includes(filters.artist)) return false;
    if (filters.friend && !night.friends.includes(filters.friend)) return false;

    if (filters.rating === "rated" && night.rating <= 0) return false;
    if (typeof filters.rating === "number" && night.rating !== filters.rating) return false;

    if (!normalizedQuery) return true;
    const searchable = [
      night.eventName,
      night.venueName,
      night.city,
      ...night.artistsSeen,
      ...night.friends,
      night.notes,
      night.favoriteMoment,
    ].join(" ").toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function groupNightsByYearMonth(nights: Night[]): NightTimelineSection[] {
  const sorted = [...nights].sort((first, second) =>
    second.date.localeCompare(first.date)
    || second.updatedAt.localeCompare(first.updatedAt),
  );
  const groups = new Map<string, { year: string; month: number; data: Night[] }>();

  for (const night of sorted) {
    const year = nightYear(night);
    const month = monthValue(night);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const group = groups.get(key) ?? { year, month, data: [] };
    group.data.push(night);
    groups.set(key, group);
  }

  const orderedGroups = [...groups.entries()].sort((first, second) => second[0].localeCompare(first[0]));
  let previousYear: string | null = null;

  return orderedGroups.map(([key, group]) => {
    const startsYear = group.year !== previousYear;
    previousYear = group.year;
    const monthDate = new Date(2000, group.month - 1, 1);
    return {
      key,
      year: group.year,
      month: group.month,
      monthLabel: group.month > 0 ? monthFormatter.format(monthDate) : "Undated",
      startsYear,
      data: group.data,
    };
  });
}
