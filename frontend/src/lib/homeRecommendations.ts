import { lineupArtistNames } from "./artistMatching";
import { localDateKey } from "./eventDiscovery";
import { buildTasteProfile, normalizeVenueName, type TasteProfile } from "./tasteProfile";
import type { EventEntry, RaveOrbCategory } from "../types/event";
import type { EventStatus } from "./eventStatusStorage";
import type { Night } from "../types/Night";

export type HomeRecommendation = { event: EventEntry; reason: string };
type EventStatuses = Record<string, EventStatus>;

function isThisWeekend(date: string, now: Date): boolean {
  const friday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = friday.getDay();
  friday.setDate(friday.getDate() + (day === 0 ? -2 : 5 - day));
  const sunday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 2);
  return date >= localDateKey(friday) && date <= localDateKey(sunday) && date >= localDateKey(now);
}

export function scoreRecommendation(event: EventEntry, profile: TasteProfile, now: Date): { score: number; reason: string } {
  let score = 0;
  const reasons: { score: number; text: string }[] = [];
  for (const artist of lineupArtistNames(event.artists)) {
    const taste = profile.artists.get(artist.key);
    if (!taste) continue;
    score += taste.score;
    if (taste.score > 0) {
      if (taste.followed) reasons.push({ score: taste.score, text: `An artist you follow: ${taste.label}` });
      else if (taste.evidence) {
        const venue = taste.evidence.venue ? ` at ${taste.evidence.venue}` : "";
        reasons.push({ score: taste.score, text: `Because you rated a Night with ${taste.label}${venue} ${taste.evidence.rating}★` });
      }
    }
  }
  const venue = profile.venues.get(normalizeVenueName(event.venueName));
  if (venue) {
    score += venue.score;
    if (venue.score > 0 && venue.evidence) reasons.push({ score: venue.score, text: `You rated a Night at ${venue.label} ${venue.evidence.rating}★` });
  }
  const category = event.raveOrbCategory ? profile.categories.get(event.raveOrbCategory) : undefined;
  if (category) {
    score += category.score;
    if (category.score > 0) {
      if (category.favourite) reasons.push({ score: category.score, text: `One of your favourite styles: ${category.label}` });
      else if (category.evidence) reasons.push({ score: category.score, text: `You rated a ${category.label} Night ${category.evidence.rating}★` });
    }
  }
  const weekend = isThisWeekend(event.date, now);
  if (weekend) score += 1;
  reasons.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
  return { score, reason: reasons[0]?.text ?? (weekend ? "Happening this weekend" : "Upcoming event in Discovery") };
}

function compareEvents(a: EventEntry, b: EventEntry): number {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id);
}

export function sortEventsForYou(events: EventEntry[], profile: TasteProfile, excluded: ReadonlySet<string>, now: Date): HomeRecommendation[] {
  if (profile.coldStart) {
    return [...events].sort((a, b) => Number(excluded.has(a.id)) - Number(excluded.has(b.id))
      || a.date.localeCompare(b.date) || (b.electronicScore ?? 0) - (a.electronicScore ?? 0)
      || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
      .map((event) => ({ event, reason: "Upcoming event in Discovery" }));
  }
  return events.map((event) => ({ event, ...scoreRecommendation(event, profile, now) }))
    .sort((a, b) => Number(excluded.has(a.event.id)) - Number(excluded.has(b.event.id))
      || b.score - a.score || compareEvents(a.event, b.event))
    .map(({ event, reason }) => ({ event, reason }));
}

export function getHomeRecommendations(
  nights: Night[],
  events: EventEntry[],
  statuses: EventStatuses,
  now = new Date(),
  limit = 10,
  city: string | null = null,
  favouriteCategories: RaveOrbCategory[] = [],
  followedArtists: ReadonlyMap<string, string> = new Map(),
  linkedEvents: EventEntry[] = [],
  excluded: ReadonlySet<string> = new Set(),
): HomeRecommendation[] {
  const profile = buildTasteProfile(nights, followedArtists, { favouriteCategories }, linkedEvents, now);
  const attendedIds = new Set(nights.flatMap((night) => night.sourceEventId ? [night.sourceEventId] : []));
  for (const [id, status] of Object.entries(statuses)) if (status === "attended") attendedIds.add(id);
  const candidates = events.filter((event) => event.date >= localDateKey(now) && !attendedIds.has(event.id)
    && statuses[event.id] !== "going" && !excluded.has(event.id)
    && (!city || normalizeVenueName(event.city) === normalizeVenueName(city)));

  if (profile.coldStart) {
    const genres = new Set(events.filter((event) => attendedIds.has(event.id))
      .flatMap((event) => event.genres.map(normalizeVenueName)));
    return candidates.map((event) => {
      const matched = event.genres.filter((genre) => genres.has(normalizeVenueName(genre)));
      return { event, score: matched.length * 4, reason: matched.length ? `Genres you saw: ${matched.slice(0, 2).join(", ")}` : "Upcoming event in Discovery" };
    }).sort((a, b) => b.score - a.score || compareEvents(a.event, b.event))
      .slice(0, Math.max(0, limit)).map(({ event, reason }) => ({ event, reason }));
  }
  return sortEventsForYou(candidates, profile, excluded, now).slice(0, Math.max(0, limit));
}
