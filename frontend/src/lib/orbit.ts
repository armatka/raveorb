import { normalizeArtistName, splitLineupNames } from "./artistResolver";
import type { Night, CurrencyCode } from "../types/Night";
import type { EventEntry } from "../types/event";

type Count = { label: string; value: number };
type Spend = { currency: CurrencyCode; total: number };

export type OrbitData = {
  year: string;
  totalNights: number;
  distinctVenues: number;
  distinctCities: number;
  distinctArtists: number;
  topArtists: Count[] | null;
  topVenues: Count[] | null;
  favouriteStyle: Count | null;
  busiestMonth: Count | null;
  longestWeekendStreak: number | null;
  highestRatedNight: Night | null;
  favouriteMoment: string | null;
  topFriends: Count[] | null;
  spending: Spend[] | null;
  firstNight: Night;
  lastNight: Night;
};

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const normalize = (name: string) => name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getOrbitYears(nights: Night[]): string[] {
  return [...new Set(nights.filter((night) => validDate(night.date)).map((night) => night.date.slice(0, 4)))].sort(compareText).reverse();
}

export function nightsInOrbitYear(nights: Night[], year: string): Night[] {
  return nights.filter((night) => validDate(night.date) && night.date.slice(0, 4) === year);
}

function counts(nights: Night[], select: (night: Night) => string[], keyOf = normalize): Count[] {
  const result = new Map<string, Count>();
  for (const night of nights) {
    const seen = new Set<string>();
    for (const name of select(night)) {
      const label = name.trim().replace(/\s+/g, " ");
      const key = keyOf(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = result.get(key);
      if (existing) {
        existing.value += 1;
        if (compareText(label, existing.label) < 0) existing.label = label;
      } else result.set(key, { label, value: 1 });
    }
  }
  return [...result.values()].sort((a, b) => b.value - a.value || compareText(keyOf(a.label), keyOf(b.label)) || compareText(a.label, b.label));
}

function weekendStreak(nights: Night[]): number | null {
  const weekends = new Set<number>();
  for (const night of nights) {
    const day = new Date(`${night.date}T12:00:00Z`);
    const weekday = day.getUTCDay();
    if (weekday !== 5 && weekday !== 6 && weekday !== 0) continue;
    day.setUTCDate(day.getUTCDate() - (weekday === 0 ? 2 : weekday - 5));
    weekends.add(day.getTime());
  }
  const sorted = [...weekends].sort((a, b) => a - b);
  if (!sorted.length) return null;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    current = sorted[i] - sorted[i - 1] === 7 * 86400000 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

export function buildOrbit(nights: Night[], year: string, events: EventEntry[] = []): OrbitData | null {
  const scoped = nightsInOrbitYear(nights, year)
    .sort((a, b) => compareText(a.date, b.date) || compareText(a.id, b.id));
  if (scoped.length < 3) return null;
  const artists = counts(scoped, (night) => night.artistsSeen.flatMap(splitLineupNames), normalizeArtistName);
  const venues = counts(scoped, (night) => [night.venueName]);
  const cities = counts(scoped, (night) => [night.city]);
  const friends = counts(scoped, (night) => night.friends);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const styles = counts(scoped, (night) => {
    const style = night.sourceEventId ? eventById.get(night.sourceEventId)?.raveOrbCategory : undefined;
    return style && style !== "Other" ? [style] : [];
  });
  const months = counts(scoped, (night) => [night.date.slice(0, 7)]);
  const highestRatedNight = [...scoped].filter((night) => Number.isFinite(night.rating) && night.rating >= 1 && night.rating <= 5)
    .sort((a, b) => b.rating - a.rating || compareText(b.date, a.date) || compareText(a.id, b.id))[0] ?? null;
  const totals = new Map<CurrencyCode, number>();
  for (const night of scoped) {
    if (Number.isFinite(night.cost) && night.cost > 0 && ["CAD", "USD", "EUR"].includes(night.currency)) {
      totals.set(night.currency, (totals.get(night.currency) ?? 0) + night.cost);
    }
  }
  const spending = [...totals].sort(([a], [b]) => compareText(a, b)).map(([currency, total]) => ({ currency, total }));
  return {
    year, totalNights: scoped.length, distinctVenues: venues.length, distinctCities: cities.length, distinctArtists: artists.length,
    topArtists: artists.slice(0, 5).length ? artists.slice(0, 5) : null,
    topVenues: venues.slice(0, 3).length ? venues.slice(0, 3) : null,
    favouriteStyle: styles[0] ?? null, busiestMonth: months[0] ?? null, longestWeekendStreak: weekendStreak(scoped),
    highestRatedNight, favouriteMoment: highestRatedNight?.favoriteMoment.trim() || null,
    topFriends: friends.slice(0, 3).length ? friends.slice(0, 3) : null,
    spending: spending.length ? spending : null, firstNight: scoped[0], lastNight: scoped[scoped.length - 1],
  };
}

export function buildShareCardData(orbit: OrbitData, options: { showFriends?: boolean; showSpending?: boolean } = {}) {
  return {
    year: orbit.year,
    totalNights: orbit.totalNights,
    distinctVenues: orbit.distinctVenues,
    distinctCities: orbit.distinctCities,
    distinctArtists: orbit.distinctArtists,
    topArtists: orbit.topArtists,
    favouriteStyle: orbit.favouriteStyle,
    ...(options.showFriends && orbit.topFriends ? { friends: orbit.topFriends } : {}),
    ...(options.showSpending && orbit.spending ? { spending: orbit.spending } : {}),
  };
}

export function homeOrbitYear(now: Date): string | null {
  if (now.getMonth() === 11) return String(now.getFullYear());
  if (now.getMonth() === 0) return String(now.getFullYear() - 1);
  return null;
}

export function homeOrbitReady(nights: Night[], now: Date, dismissedYear: string | null): string | null {
  const year = homeOrbitYear(now);
  return year && year !== dismissedYear && nightsInOrbitYear(nights, year).length >= 3 ? year : null;
}
