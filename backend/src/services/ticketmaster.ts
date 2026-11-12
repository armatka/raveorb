import type { EventEntry, EventType } from "../types/index.js";

const DISCOVERY_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 200;

type TicketmasterDate = {
  localDate?: string;
  localTime?: string;
  dateTime?: string;
};

type TicketmasterImage = {
  url?: string;
  width?: number;
  ratio?: string;
};

type TicketmasterClassification = {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
  type?: { name?: string };
  subType?: { name?: string };
};

type TicketmasterAttraction = { name?: string };

type TicketmasterVenue = {
  id?: string;
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { name?: string; stateCode?: string };
  country?: { name?: string; countryCode?: string };
  location?: { latitude?: string; longitude?: string };
  postalCode?: string;
  timezone?: string;
};

type TicketmasterEvent = {
  id?: string;
  name?: string;
  description?: string;
  info?: string;
  pleaseNote?: string;
  url?: string;
  dates?: {
    start?: TicketmasterDate;
    timezone?: string;
    status?: { code?: string };
  };
  sales?: { public?: { startDateTime?: string; endDateTime?: string } };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  images?: TicketmasterImage[];
  classifications?: TicketmasterClassification[];
  _embedded?: {
    venues?: TicketmasterVenue[];
    attractions?: TicketmasterAttraction[];
  };
};

type TicketmasterEventsResponse = {
  _embedded?: { events?: TicketmasterEvent[] };
  _page?: { number?: number; size?: number; totalPages?: number; totalElements?: number };
};

export type TicketmasterSearchFilters = {
  keyword?: string;
  city?: string;
  countryCode: string;
  postalCode?: string;
  latlong?: string;
  radius?: number;
  unit: "km" | "miles";
  classificationName: string;
  genreId?: string;
  startDateTime?: string;
  endDateTime?: string;
  page: number;
  size: number;
  sort: string;
  legacyGenre?: string;
  legacyType?: EventType;
  legacyStartDate?: string;
  legacyEndDate?: string;
};

export type TicketmasterPage = {
  events: EventEntry[];
  page: number;
  totalPages: number;
  totalElements: number;
};

export class TicketmasterError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly kind: "configuration" | "upstream" | "network" | "invalid-response",
    readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = "TicketmasterError";
  }
}

export class TicketmasterQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketmasterQueryError";
  }
}

type CachedPage = { expiresAt: number; value: TicketmasterPage };
const searchCache = new Map<string, CachedPage>();
const eventCache = new Map<string, { expiresAt: number; value: EventEntry }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime())
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

function typeFromClassification(classifications: TicketmasterClassification[], name: string): EventType {
  const labels = classifications.flatMap((item) => [item.type?.name, item.subType?.name, item.segment?.name])
    .filter((item): item is string => Boolean(item)).join(" ").toLowerCase();
  const combined = `${labels} ${name}`.toLowerCase();
  if (combined.includes("festival")) return "festival";
  if (combined.includes("rave")) return "rave";
  if (combined.includes("club") || combined.includes("nightclub")) return "club";
  return "concert";
}

function statusFromTicketmaster(code: string | undefined): EventEntry["status"] {
  switch (code?.toLowerCase()) {
    case "cancelled": return "cancelled";
    case "postponed":
    case "rescheduled": return "postponed";
    case "onsale": return "scheduled";
    default: return undefined;
  }
}

export function mapTicketmasterEvent(value: unknown): EventEntry | null {
  if (!isRecord(value)) return null;
  const event = value as TicketmasterEvent;
  const id = string(event.id);
  const title = string(event.name);
  if (!id || !title) return null;

  const dates = record(event.dates);
  const start = record(dates.start);
  const dateTime = string(start.dateTime);
  const date = string(start.localDate) ?? dateTime?.slice(0, 10);
  if (!date || !validDate(date)) return null;
  const localTime = string(start.localTime) ?? (dateTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateTime) ? dateTime.slice(11, 16) : "00:00");

  const embedded = record(event._embedded);
  const venue = record(array(embedded.venues)[0]);
  const venueCity = record(venue.city);
  const venueState = record(venue.state);
  const venueCountry = record(venue.country);
  const venueLocation = record(venue.location);
  const classifications = array(event.classifications).filter(isRecord) as TicketmasterClassification[];
  const artists = array(embedded.attractions).flatMap((attraction) => {
    const attractionName = string(record(attraction).name);
    return attractionName ? [attractionName] : [];
  });
  const genreMap = new Map<string, string>();
  for (const classification of classifications) {
    for (const name of [classification.genre?.name, classification.subGenre?.name]) {
      const cleanName = string(name);
      if (cleanName) genreMap.set(cleanName.toLowerCase(), cleanName);
    }
  }
  const images = array(event.images).filter(isRecord) as TicketmasterImage[];
  const image = [...images].sort((first, second) => {
    const ratioDifference = Number(second.ratio === "16_9") - Number(first.ratio === "16_9");
    return ratioDifference || (number(second.width) ?? 0) - (number(first.width) ?? 0);
  }).find((item) => string(item.url));
  const ranges = array(event.priceRanges).filter(isRecord);
  const currency = ranges.map((item) => string(record(item).currency)).find(Boolean);
  const sameCurrencyRanges = ranges.filter((item) => string(record(item).currency) === currency);
  const minimums = sameCurrencyRanges.map((item) => number(record(item).min)).filter((item): item is number => item !== undefined);
  const maximums = sameCurrencyRanges.map((item) => number(record(item).max)).filter((item): item is number => item !== undefined);
  const ticketSales = record(event.sales);
  const publicSales = record(ticketSales.public);
  const province = string(venueState.name) ?? string(venueState.stateCode);
  const country = string(venueCountry.name);
  const countryCode = string(venueCountry.countryCode) ?? "";
  const latitude = number(venueLocation.latitude);
  const longitude = number(venueLocation.longitude);

  return {
    id,
    title,
    type: typeFromClassification(classifications, title),
    venueId: string(venue.id) ?? `ticketmaster-venue-${id}`,
    venueName: string(venue.name) ?? "Venue to be announced",
    city: string(venueCity.name) ?? "",
    countryCode,
    ...(province ? { province } : {}),
    ...(country ? { country } : {}),
    ...(string(record(venue.address).line1) ? { address: string(record(venue.address).line1) } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    date,
    startTime: localTime,
    endTime: "",
    ...(dateTime ? { dateTime } : {}),
    timezone: string(dates.timezone) ?? string(venue.timezone) ?? "",
    artists,
    genres: [...genreMap.values()],
    description: string(event.description) ?? string(event.info) ?? string(event.pleaseNote) ?? "",
    ...(string(image?.url) ? { imageUrl: string(image?.url) } : {}),
    ...(string(event.url) ? { ticketUrl: string(event.url), eventUrl: string(event.url) } : {}),
    ...(minimums.length ? { priceMin: Math.min(...minimums) } : {}),
    ...(maximums.length ? { priceMax: Math.max(...maximums) } : {}),
    ...(currency ? { currency } : {}),
    source: "ticketmaster",
    sourceEventId: id,
    ...(string(publicSales.startDateTime) ? { ticketSaleStartDateTime: string(publicSales.startDateTime) } : {}),
    ...(string(publicSales.endDateTime) ? { ticketSaleEndDateTime: string(publicSales.endDateTime) } : {}),
    ...(statusFromTicketmaster(string(record(dates.status).code)) ? { status: statusFromTicketmaster(string(record(dates.status).code)) } : {}),
  };
}

function singleQueryValue(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new TicketmasterQueryError(`${key} must be a single value.`);
  const clean = value.trim();
  if (clean.length > 120) throw new TicketmasterQueryError(`${key} must be 120 characters or fewer.`);
  return clean || undefined;
}

function integerQueryValue(value: string | undefined, key: string, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new TicketmasterQueryError(`${key} must be a whole number.`);
  const parsed = Number(value);
  if (parsed < min || parsed > max) throw new TicketmasterQueryError(`${key} must be between ${min} and ${max}.`);
  return parsed;
}

function validateDateTime(value: string | undefined, key: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new TicketmasterQueryError(`${key} must be a valid ISO date-time.`);
  }
  return value;
}

const allowedQueryKeys = new Set([
  "keyword", "search", "city", "countryCode", "postalCode", "latlong", "radius", "unit",
  "classificationName", "genreId", "startDateTime", "endDateTime", "page", "size", "sort",
  "genre", "type", "startDate", "endDate",
]);
const validSorts = new Set(["date,asc", "date,desc", "name,asc", "name,desc", "relevance,desc", "distance,asc", "onSaleDate,asc"]);
const validTypes = new Set<EventType>(["festival", "rave", "concert", "club"]);

export function parseTicketmasterQuery(query: Record<string, unknown>): TicketmasterSearchFilters {
  for (const key of Object.keys(query)) if (!allowedQueryKeys.has(key)) throw new TicketmasterQueryError(`Unsupported query parameter: ${key}`);
  const keyword = singleQueryValue(query, "keyword") ?? singleQueryValue(query, "search");
  const city = singleQueryValue(query, "city");
  const rawCountryCode = singleQueryValue(query, "countryCode") ?? "CA";
  if (!/^[a-z]{2}$/i.test(rawCountryCode)) throw new TicketmasterQueryError("countryCode must be a two-letter code.");
  const postalCode = singleQueryValue(query, "postalCode");
  const latlong = singleQueryValue(query, "latlong");
  if (latlong) {
    const match = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(latlong);
    if (!match || Math.abs(Number(match[1])) > 90 || Math.abs(Number(match[2])) > 180) throw new TicketmasterQueryError("latlong must be valid latitude,longitude coordinates.");
  }
  const radiusText = singleQueryValue(query, "radius");
  let radius: number | undefined;
  if (radiusText !== undefined) {
    radius = Number(radiusText);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 1000) throw new TicketmasterQueryError("radius must be greater than 0 and no more than 1000.");
  }
  const unitText = singleQueryValue(query, "unit") ?? "km";
  if (unitText !== "km" && unitText !== "miles") throw new TicketmasterQueryError("unit must be km or miles.");
  const classificationName = singleQueryValue(query, "classificationName") ?? "Music";
  const genreId = singleQueryValue(query, "genreId");
  const startDate = singleQueryValue(query, "startDate");
  const endDate = singleQueryValue(query, "endDate");
  if (startDate && !validDate(startDate)) throw new TicketmasterQueryError("startDate must be a valid YYYY-MM-DD date.");
  if (endDate && !validDate(endDate)) throw new TicketmasterQueryError("endDate must be a valid YYYY-MM-DD date.");
  if (startDate && endDate && startDate > endDate) throw new TicketmasterQueryError("startDate must be on or before endDate.");
  const rawSort = singleQueryValue(query, "sort") ?? "date,asc";
  if (!validSorts.has(rawSort)) throw new TicketmasterQueryError("sort is not supported.");
  const rawType = singleQueryValue(query, "type");
  if (rawType && !validTypes.has(rawType as EventType)) throw new TicketmasterQueryError("type is not supported.");
  return {
    ...(keyword ? { keyword } : {}), ...(city ? { city } : {}), countryCode: rawCountryCode.toUpperCase(),
    ...(postalCode ? { postalCode } : {}), ...(latlong ? { latlong: latlong.replace(/\s/g, "") } : {}),
    ...(radius !== undefined ? { radius } : {}), unit: unitText,
    classificationName, ...(genreId ? { genreId } : {}),
    ...(validateDateTime(singleQueryValue(query, "startDateTime"), "startDateTime") ? { startDateTime: validateDateTime(singleQueryValue(query, "startDateTime"), "startDateTime") } : startDate ? { startDateTime: `${startDate}T00:00:00Z` } : {}),
    ...(validateDateTime(singleQueryValue(query, "endDateTime"), "endDateTime") ? { endDateTime: validateDateTime(singleQueryValue(query, "endDateTime"), "endDateTime") } : endDate ? { endDateTime: `${endDate}T23:59:59Z` } : {}),
    page: integerQueryValue(singleQueryValue(query, "page"), "page", 0, 0, 100000),
    size: integerQueryValue(singleQueryValue(query, "size"), "size", 20, 1, 50),
    sort: rawSort,
    ...(singleQueryValue(query, "genre") ? { legacyGenre: singleQueryValue(query, "genre") } : {}),
    ...(rawType ? { legacyType: rawType as EventType } : {}),
    ...(startDate ? { legacyStartDate: startDate } : {}), ...(endDate ? { legacyEndDate: endDate } : {}),
  };
}

function cacheKey(filters: TicketmasterSearchFilters): string {
  return JSON.stringify(Object.entries(filters).filter(([key]) => !key.startsWith("legacy")).sort(([first], [second]) => first.localeCompare(second)));
}

function isExpired(expiresAt: number): boolean { return expiresAt <= Date.now(); }

function fromResponsePage(response: TicketmasterEventsResponse, requestedPage: number): TicketmasterPage {
  const page = record(response._page);
  const rawEvents = array(record(response._embedded).events);
  const events = rawEvents.map(mapTicketmasterEvent).filter((event): event is EventEntry => event !== null);
  return {
    events,
    page: number(page.number) ?? requestedPage,
    totalPages: number(page.totalPages) ?? 1,
    totalElements: number(page.totalElements) ?? events.length,
  };
}

async function requestTicketmaster(url: URL): Promise<TicketmasterEventsResponse> {
  const apiKey = process.env.TICKETMASTER_API_KEY?.trim();
  if (!apiKey) throw new TicketmasterError("Ticketmaster event service is not configured.", 500, "configuration");
  url.searchParams.set("apikey", apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
  } catch {
    throw new TicketmasterError(controller.signal.aborted ? "Ticketmaster request timed out." : "Ticketmaster could not be reached.", 502, "network");
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
    const message = response.status === 401 || response.status === 403 ? "Ticketmaster authentication failed."
      : response.status === 404 ? "Ticketmaster event was not found."
        : response.status === 429 ? "Ticketmaster rate limit reached. Try again shortly."
          : statusCode === 502 ? "Ticketmaster is temporarily unavailable." : "Ticketmaster rejected the event request.";
    throw new TicketmasterError(message, statusCode, "upstream", response.status);
  }
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload)) throw new Error("Invalid response");
    return payload as TicketmasterEventsResponse;
  } catch {
    throw new TicketmasterError("Ticketmaster returned an invalid response.", 502, "invalid-response", response.status);
  }
}

function assertApiKeyConfigured(): void {
  if (!process.env.TICKETMASTER_API_KEY?.trim()) {
    throw new TicketmasterError("Ticketmaster event service is not configured.", 500, "configuration");
  }
}

function buildUrl(filters: TicketmasterSearchFilters): URL {
  const url = new URL(DISCOVERY_URL);
  const params = url.searchParams;
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.city) params.set("city", filters.city);
  params.set("countryCode", filters.countryCode);
  if (filters.postalCode) params.set("postalCode", filters.postalCode);
  if (filters.latlong) params.set("latlong", filters.latlong);
  if (filters.radius !== undefined) params.set("radius", String(filters.radius));
  params.set("unit", filters.unit);
  params.set("classificationName", filters.classificationName);
  if (filters.genreId) params.set("genreId", filters.genreId);
  if (filters.startDateTime) params.set("startDateTime", filters.startDateTime);
  if (filters.endDateTime) params.set("endDateTime", filters.endDateTime);
  params.set("page", String(filters.page));
  params.set("size", String(filters.size));
  params.set("sort", filters.sort);
  return url;
}

function applyLegacyFilters(page: TicketmasterPage, filters: TicketmasterSearchFilters): TicketmasterPage {
  const events = page.events.filter((event) => {
    if (filters.legacyType && event.type !== filters.legacyType) return false;
    if (filters.legacyGenre && !event.genres.some((genre) => genre.toLowerCase() === filters.legacyGenre?.toLowerCase())) return false;
    if (filters.legacyStartDate && event.date < filters.legacyStartDate) return false;
    if (filters.legacyEndDate && event.date > filters.legacyEndDate) return false;
    return true;
  });
  return { ...page, events };
}

export async function searchTicketmasterEvents(filters: TicketmasterSearchFilters): Promise<TicketmasterPage> {
  assertApiKeyConfigured();
  const key = cacheKey(filters);
  const cached = searchCache.get(key);
  if (cached && !isExpired(cached.expiresAt) && !filters.legacyType && !filters.legacyGenre && !filters.legacyStartDate && !filters.legacyEndDate) return { ...cached.value, events: [...cached.value.events] };
  if (cached) searchCache.delete(key);
  let upstreamPage: TicketmasterPage;
  if (cached && !isExpired(cached.expiresAt)) {
    upstreamPage = cached.value;
  } else {
    const response = await requestTicketmaster(buildUrl(filters));
    upstreamPage = fromResponsePage(response, filters.page);
    if (searchCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = searchCache.keys().next().value;
      if (oldest !== undefined) searchCache.delete(oldest);
    }
    searchCache.set(key, { value: upstreamPage, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  const result = applyLegacyFilters(upstreamPage, filters);
  return { ...result, events: [...result.events] };
}

export async function getTicketmasterEvent(id: string): Promise<EventEntry | null> {
  assertApiKeyConfigured();
  const sourceId = id.startsWith("ticketmaster-") ? id.slice("ticketmaster-".length) : id;
  const cacheKey = `event:${sourceId}`;
  const cached = eventCache.get(cacheKey);
  if (cached && !isExpired(cached.expiresAt)) return cached.value;
  if (cached) eventCache.delete(cacheKey);
  const url = new URL(`https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(sourceId)}.json`);
  const response = await requestTicketmaster(url);
  const event = mapTicketmasterEvent(response);
  if (!event) throw new TicketmasterError("Ticketmaster event data was incomplete.", 502, "invalid-response");
  eventCache.set(cacheKey, { value: event, expiresAt: Date.now() + CACHE_TTL_MS });
  return event;
}