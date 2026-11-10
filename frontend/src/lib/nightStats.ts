import type { CurrencyCode, Night } from "../types/Night";

export type NightChartItem = {
  label: string;
  value: number;
};

export type SpendSummary = {
  currency: CurrencyCode;
  total: number;
  average: number;
  nights: number;
};

export type NightStats = {
  totalNights: number;
  nightsThisYear: number;
  nightsThisMonth: number;
  averageRating: number;
  ratedNightCount: number;
  totalPhotos: number;
  uniqueCities: number;
  uniqueVenues: number;
  uniqueArtists: number;
  uniqueFriends: number;
  mostSeenArtist: NightChartItem | null;
  mostVisitedVenue: NightChartItem | null;
  mostFrequentCity: NightChartItem | null;
  mostFrequentFriend: NightChartItem | null;
  highestRatedNight: Night | null;
  busiestMonth: NightChartItem | null;
  nightsByMonth: NightChartItem[];
  nightsByCity: NightChartItem[];
  nightsByVenue: NightChartItem[];
  nightsByRating: NightChartItem[];
  artistsByFrequency: NightChartItem[];
  friendsByFrequency: NightChartItem[];
  spending: SpendSummary[];
};

export type NightStatsResult = {
  years: string[];
  stats: NightStats;
};

type NameCount = {
  label: string;
  count: number;
};

const currencyCodes: CurrencyCode[] = ["CAD", "USD", "EUR"];
const monthShort = new Intl.DateTimeFormat(undefined, { month: "short" });

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function countNames(values: string[]): NameCount[] {
  const counts = new Map<string, NameCount>();
  for (const rawValue of values) {
    const label = rawValue.trim();
    if (!label) continue;
    const key = normalizedName(label);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { label, count: 1 });
    }
  }
  return [...counts.values()].sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
}

function countNightNames(nights: Night[], select: (night: Night) => string): NameCount[] {
  return countNames(nights.map(select));
}

function countNightNameLists(nights: Night[], select: (night: Night) => string[]): NameCount[] {
  const counts = new Map<string, NameCount>();

  for (const night of nights) {
    const seenThisNight = new Set<string>();
    for (const rawValue of select(night)) {
      const label = rawValue.trim();
      if (!label) continue;
      const key = normalizedName(label);
      if (seenThisNight.has(key)) continue;
      seenThisNight.add(key);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { label, count: 1 });
      }
    }
  }

  return [...counts.values()].sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
}

function chartItems(counts: NameCount[]): NightChartItem[] {
  return counts.map(({ label, count }) => ({ label, value: count }));
}

function monthKey(dateValue: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateValue);
  if (!match) return null;
  const parsedDate = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateValue) return null;
  return `${match[1]}-${match[2]}`;
}

function formatMonthKey(key: string, selectedYear: string | null): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const label = monthShort.format(date);
  return selectedYear ? label : `${label} '${String(year).slice(-2)}`;
}

function safeCurrency(value: unknown): CurrencyCode | null {
  if (value === undefined) return "USD";
  return value === "CAD" || value === "USD" || value === "EUR" ? value : null;
}

function emptyStats(): NightStats {
  return {
    totalNights: 0,
    nightsThisYear: 0,
    nightsThisMonth: 0,
    averageRating: 0,
    ratedNightCount: 0,
    totalPhotos: 0,
    uniqueCities: 0,
    uniqueVenues: 0,
    uniqueArtists: 0,
    uniqueFriends: 0,
    mostSeenArtist: null,
    mostVisitedVenue: null,
    mostFrequentCity: null,
    mostFrequentFriend: null,
    highestRatedNight: null,
    busiestMonth: null,
    nightsByMonth: [],
    nightsByCity: [],
    nightsByVenue: [],
    nightsByRating: [],
    artistsByFrequency: [],
    friendsByFrequency: [],
    spending: [],
  };
}

export function calculateNightStats(
  nights: Night[],
  selectedYear: string | null,
  now = new Date(),
): NightStats {
  const scopedNights = selectedYear
    ? nights.filter((night) => night.date.slice(0, 4) === selectedYear)
    : nights;
  if (scopedNights.length === 0) return emptyStats();

  const validRatings = scopedNights
    .map((night) => night.rating)
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const artists = countNightNameLists(scopedNights, (night) => night.artistsSeen);
  const friends = countNightNameLists(scopedNights, (night) => night.friends);
  const venues = countNightNames(scopedNights, (night) => night.venueName);
  const cities = countNightNames(scopedNights, (night) => night.city);
  const monthlyCounts = new Map<string, number>();

  for (const night of scopedNights) {
    const key = monthKey(night.date);
    if (key) monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
  }

  const nightsByMonth = [...monthlyCounts.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => ({ label: formatMonthKey(key, selectedYear), value }));
  const busiestMonth = [...nightsByMonth].sort((first, second) => second.value - first.value || first.label.localeCompare(second.label))[0] ?? null;
  const ratingBuckets = [
    { label: "Unrated", value: scopedNights.filter((night) => night.rating === 0).length },
    ...[1, 2, 3, 4, 5].map((rating) => ({
      label: `${rating} star${rating === 1 ? "" : "s"}`,
      value: scopedNights.filter((night) => night.rating === rating).length,
    })),
  ];
  const highestRatedNight = scopedNights
    .filter((night) => Number.isFinite(night.rating) && night.rating >= 1 && night.rating <= 5)
    .sort((first, second) => second.rating - first.rating || second.date.localeCompare(first.date))[0] ?? null;
  const currentYear = String(now.getFullYear());
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const spendingByCurrency = new Map<CurrencyCode, { total: number; nights: number }>();

  for (const night of scopedNights) {
    const currency = safeCurrency(night.currency);
    if (!currency || !Number.isFinite(night.cost) || night.cost < 0) continue;
    const spend = spendingByCurrency.get(currency) ?? { total: 0, nights: 0 };
    spend.total += night.cost;
    spend.nights += 1;
    spendingByCurrency.set(currency, spend);
  }

  return {
    totalNights: scopedNights.length,
    nightsThisYear: nights.filter((night) => night.date.startsWith(`${currentYear}-`)).length,
    nightsThisMonth: nights.filter((night) => night.date.startsWith(currentMonth)).length,
    averageRating: validRatings.length ? validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length : 0,
    ratedNightCount: validRatings.length,
    totalPhotos: scopedNights.reduce((total, night) => total + (Array.isArray(night.photos) ? night.photos.length : 0), 0),
    uniqueCities: cities.length,
    uniqueVenues: venues.length,
    uniqueArtists: artists.length,
    uniqueFriends: friends.length,
    mostSeenArtist: artists[0] ? { label: artists[0].label, value: artists[0].count } : null,
    mostVisitedVenue: venues[0] ? { label: venues[0].label, value: venues[0].count } : null,
    mostFrequentCity: cities[0] ? { label: cities[0].label, value: cities[0].count } : null,
    mostFrequentFriend: friends[0] ? { label: friends[0].label, value: friends[0].count } : null,
    highestRatedNight,
    busiestMonth,
    nightsByMonth,
    nightsByCity: chartItems(cities),
    nightsByVenue: chartItems(venues),
    nightsByRating: ratingBuckets,
    artistsByFrequency: chartItems(artists),
    friendsByFrequency: chartItems(friends),
    spending: currencyCodes.flatMap((currency) => {
      const spend = spendingByCurrency.get(currency);
      return spend ? [{ currency, total: spend.total, average: spend.total / spend.nights, nights: spend.nights }] : [];
    }),
  };
}

export function getNightStats(nights: Night[], now = new Date()): NightStatsResult {
  const years = [...new Set(nights.map((night) => night.date.slice(0, 4)).filter((year) => /^\d{4}$/.test(year)))].sort((first, second) => second.localeCompare(first));
  const currentYear = String(now.getFullYear());
  const selectedYear = years.includes(currentYear) ? currentYear : (years[0] ?? null);
  return { years, stats: calculateNightStats(nights, selectedYear, now) };
}
