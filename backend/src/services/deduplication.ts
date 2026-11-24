import type { EventEntry } from "../types/index.js";

const earthRadiusMeters = 6_371_008.8;
const stopwords = new Set(["a", "an", "and", "at", "feat", "featuring", "live", "of", "presents", "the", "tickets", "w"]);

export type EventMatch = {
  match: boolean;
  score: number;
  reasons: string[];
};

export type EventListing = {
  source: string;
  id: string;
  eventUrl?: string;
};

function normalizeText(value: string, event?: EventEntry): string {
  let normalized = value.toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
  for (const localName of [event?.city, event?.province]) {
    if (!localName?.trim()) continue;
    const name = localName.toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
    if (name) normalized = ` ${normalized} `.replaceAll(` ${name} `, " ").trim();
  }
  return normalized.split(/\s+/).filter((token) => token && !stopwords.has(token)).join(" ");
}

function tokens(value: string, event?: EventEntry): Set<string> {
  return new Set(normalizeText(value, event).split(/\s+/).filter(Boolean));
}

function overlap(first: Set<string>, second: Set<string>): number {
  if (!first.size || !second.size) return 0;
  let shared = 0;
  for (const token of first) if (second.has(token)) shared++;
  return shared / Math.min(first.size, second.size);
}

function distanceMeters(first: EventEntry, second: EventEntry): number | undefined {
  if (first.latitude === undefined || first.longitude === undefined
    || second.latitude === undefined || second.longitude === undefined) return undefined;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const halfChord = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(halfChord));
}

function sameLocality(first: EventEntry, second: EventEntry): boolean {
  if (first.city && second.city && normalizeText(first.city) !== normalizeText(second.city)) return false;
  if (first.countryCode && second.countryCode && first.countryCode.toUpperCase() !== second.countryCode.toUpperCase()) return false;
  return true;
}

function venueMatch(first: EventEntry, second: EventEntry): { matched: boolean; reason?: string } {
  const distance = distanceMeters(first, second);
  if (distance !== undefined && distance <= 300) return { matched: true, reason: "venue-within-300m" };
  if (!sameLocality(first, second)) return { matched: false };

  const firstName = normalizeText(first.venueName, first);
  const secondName = normalizeText(second.venueName, second);
  if (!firstName || !secondName) return { matched: false };
  if (firstName === secondName) return { matched: true, reason: "same-venue-name" };

  const shorter = firstName.length <= secondName.length ? firstName : secondName;
  const longer = firstName.length <= secondName.length ? secondName : firstName;
  if (shorter.length < 4) return { matched: false };
  if (longer.includes(shorter)) return { matched: true, reason: "similar-venue-name" };
  if (overlap(new Set(firstName.split(" ")), new Set(secondName.split(" "))) >= 0.8) {
    return { matched: true, reason: "similar-venue-name" };
  }
  return { matched: false };
}

function dateMatch(first: EventEntry, second: EventEntry): { matched: boolean; reason: string } {
  if (first.date === second.date) return { matched: true, reason: "same-local-date" };
  const firstDate = Date.parse(`${first.date}T00:00:00Z`);
  const secondDate = Date.parse(`${second.date}T00:00:00Z`);
  const dateDelta = (secondDate - firstDate) / 86_400_000;
  const firstMinutes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(first.startTime);
  const secondMinutes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(second.startTime);
  if (Math.abs(dateDelta) !== 1 || !firstMinutes || !secondMinutes) return { matched: false, reason: "" };
  const firstTime = Number(firstMinutes[1]) * 60 + Number(firstMinutes[2]);
  const secondTime = Number(secondMinutes[1]) * 60 + Number(secondMinutes[2]);
  const elapsedMinutes = dateDelta * 1440 + secondTime - firstTime;
  return Math.abs(elapsedMinutes) <= 240
    ? { matched: true, reason: "adjacent-date-late-night" }
    : { matched: false, reason: "" };
}

export function isLikelySameEvent(first: EventEntry, second: EventEntry): EventMatch {
  if (first.source === second.source) return { match: false, score: 0, reasons: ["same-provider"] };

  const date = dateMatch(first, second);
  const venue = venueMatch(first, second);
  const titleOverlap = overlap(tokens(first.title, first), tokens(second.title, second));
  const sharedArtist = first.artists.some((artist) => {
    const artistTokens = tokens(artist, first);
    return artistTokens.size > 0 && second.artists.some((other) => {
      const otherTokens = tokens(other, second);
      return overlap(artistTokens, otherTokens) >= 1;
    });
  });
  const titleOrArtistMatches = titleOverlap >= 0.6 || sharedArtist;
  const reasons = [
    ...(date.matched ? [date.reason] : []),
    ...(venue.reason ? [venue.reason] : []),
    ...(titleOverlap >= 0.6 ? ["similar-title"] : sharedArtist ? ["shared-artist"] : []),
  ];
  return {
    match: date.matched && venue.matched && titleOrArtistMatches,
    score: Math.round(((date.matched ? 0.25 : 0) + (venue.matched ? 0.4 : 0)
      + (titleOverlap >= 0.6 || sharedArtist ? 0.35 : 0)) * 100) / 100,
    reasons,
  };
}

function filledFieldCount(event: EventEntry): number {
  return Object.values(event).filter((value) => value !== undefined && value !== null && value !== "").length;
}

function primaryRank(event: EventEntry): [number, number, number] {
  return [event.ticketUrl ? 1 : 0, event.source === "ticketmaster" ? 1 : 0, filledFieldCount(event)];
}

function compareRank(first: EventEntry, second: EventEntry): number {
  const firstRank = primaryRank(first);
  const secondRank = primaryRank(second);
  for (let index = 0; index < firstRank.length; index++) {
    if (firstRank[index] !== secondRank[index]) return secondRank[index] - firstRank[index];
  }
  return 0;
}

function listing(event: EventEntry): EventListing {
  return {
    source: event.source,
    id: event.id,
    ...(event.eventUrl ? { eventUrl: event.eventUrl } : {}),
  };
}

function mergeGroup(group: EventEntry[]): EventEntry {
  const ordered = [...group].sort(compareRank);
  const primary = ordered[0];
  const alsoListedOn = new Map<string, EventListing>();
  for (const event of ordered.slice(1)) alsoListedOn.set(`${event.source}:${event.id}`, listing(event));
  for (const event of ordered) {
    for (const item of event.alsoListedOn ?? []) alsoListedOn.set(`${item.source}:${item.id}`, item);
  }
  return {
    ...primary,
    description: primary.description || ordered.find((event) => event.description)?.description || "",
    artists: primary.artists.length ? primary.artists : ordered.find((event) => event.artists.length)?.artists ?? [],
    ...(!primary.imageUrl && ordered.find((event) => event.imageUrl)?.imageUrl
      ? { imageUrl: ordered.find((event) => event.imageUrl)!.imageUrl }
      : {}),
    ...(alsoListedOn.size ? { alsoListedOn: [...alsoListedOn.values()] } : {}),
  };
}

export function deduplicateEvents(events: EventEntry[]): EventEntry[] {
  const groups: EventEntry[][] = [];
  for (const event of events) {
    const group = groups.find((candidate) => !candidate.some((existing) => existing.source === event.source)
      && candidate.some((existing) => isLikelySameEvent(event, existing).match));
    if (group) group.push(event);
    else groups.push([event]);
  }
  return groups.map(mergeGroup);
}
