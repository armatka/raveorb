import type { EventEntry } from "../types/event";
import type { SetTime } from "./beacon";

export type PlannedSet = {
  id: string;
  artist: string;
  stage: string;
  day: string;
  start: string;
  end: string;
  starred: boolean;
};

export type FestivalPlan = {
  version: 1;
  eventId: string;
  event: Pick<EventEntry, "id" | "title">;
  updatedAt: string;
  stages: string[];
  days: string[];
  sets: PlannedSet[];
};

export type TimedSet = { set: PlannedSet; start: number; end: number };

export function validFestivalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function festivalDays(first: string, last: string): string[] {
  if (!validFestivalDate(first) || !validFestivalDate(last) || last < first) throw new Error("Invalid festival day.");
  const start = Date.parse(`${first}T00:00:00Z`);
  const count = (Date.parse(`${last}T00:00:00Z`) - start) / 86400000 + 1;
  if (count > 366) throw new Error("Festival days must be within one year.");
  return Array.from({ length: count }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10));
}

export function createFestivalPlan(event: EventEntry): FestivalPlan {
  if (!validFestivalDate(event.date)) throw new Error("The event needs a valid date before it can be planned.");
  return {
    version: 1, eventId: event.id, event, updatedAt: new Date().toISOString(),
    stages: [], days: [event.date],
    sets: event.artists.map((artist, index) => ({
      id: `lineup-${index}`, artist, stage: "", day: event.date, start: "", end: "", starred: false,
    })),
  };
}

function minutes(time: string): number | null {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}

export function timedSet(set: PlannedSet, days: string[]): TimedSet | null {
  const index = [...days].sort().indexOf(set.day);
  const startTime = minutes(set.start);
  const endTime = minutes(set.end);
  if (index < 0 || startTime === null || endTime === null || startTime === endTime) return null;
  const start = index * 1440 + startTime + (startTime < 360 ? 1440 : 0);
  let end = index * 1440 + endTime + (endTime < 360 ? 1440 : 0);
  if (end <= start) end += 1440;
  return { set, start, end };
}

export function sortedSets(plan: FestivalPlan, starredOnly = false): TimedSet[] {
  return plan.sets.flatMap((set) => {
    if (starredOnly && !set.starred) return [];
    const timed = timedSet(set, plan.days);
    return timed ? [timed] : [];
  }).sort((a, b) => a.start - b.start || a.end - b.end || a.set.id.localeCompare(b.set.id));
}

export function overlaps(a: TimedSet, b: TimedSet): boolean {
  return a.start < b.end && b.start < a.end;
}

export function clashesFor(item: TimedSet, sets: TimedSet[]): TimedSet[] {
  return sets.filter((other) => other.set.id !== item.set.id && overlaps(item, other));
}

export function keepSet(plan: FestivalPlan, id: string): FestivalPlan {
  const selected = sortedSets(plan, true);
  const keep = selected.find((item) => item.set.id === id);
  if (!keep) return plan;
  const clashes = new Set(clashesFor(keep, selected).map((item) => item.set.id));
  return { ...plan, sets: plan.sets.map((set) => clashes.has(set.id) ? { ...set, starred: false } : set) };
}

export function scheduleGaps(sets: TimedSet[]): Map<string, number> {
  const gaps = new Map<string, number>();
  let end = -Infinity;
  for (const item of sets) {
    if (end !== -Infinity && item.start > end) gaps.set(item.set.id, item.start - end);
    end = Math.max(end, item.end);
  }
  return gaps;
}

export function beaconSetsFromPlan(plan: FestivalPlan | null): SetTime[] {
  return plan ? sortedSets(plan, true).map(({ set }) => ({
    artist: set.artist,
    time: `${plan.days.length > 1 ? `${set.day} · ` : ""}${set.start}${set.start < "06:00" ? " (+1 day)" : ""}`,
  })) : [];
}

export function synchronizeBeaconSets<T extends { sets: SetTime[]; setsEditedManually?: boolean }>(
  details: T, plan: FestivalPlan | null, fallbackSets: SetTime[] = details.sets,
): { details: T; planSets: SetTime[]; canUsePlan: boolean } {
  const planSets = beaconSetsFromPlan(plan);
  const available = planSets.length > 0;
  const manual = details.setsEditedManually ?? true;
  const different = JSON.stringify(details.sets) !== JSON.stringify(planSets);
  return {
    details: plan && !manual ? { ...details, sets: available ? planSets : fallbackSets } : details,
    planSets,
    canUsePlan: available && manual && different,
  };
}
