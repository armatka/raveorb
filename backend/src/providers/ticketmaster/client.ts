import type { EventEntry } from "../../types/index.js";
import { ProviderError, type EventSearchQuery, type ProviderPage } from "../types.js";
import { mapTicketmasterEvent } from "./mapping.js";

const DISCOVERY_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 200;
const MAX_PAGE_OFFSET = 1000;

type TicketmasterPage = { number?: number; size?: number; totalPages?: number; totalElements?: number };
type TicketmasterEventsResponse = {
  _embedded?: { events?: unknown[] };
  page?: TicketmasterPage;
  _page?: TicketmasterPage;
};

type CachedPage = { expiresAt: number; value: ProviderPage };
const searchCache = new Map<string, CachedPage>();
const eventCache = new Map<string, { expiresAt: number; value: EventEntry }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isExpired(expiresAt: number): boolean { return expiresAt <= Date.now(); }

function fromResponsePage(response: TicketmasterEventsResponse, requestedPage: number, requestedSize: number): ProviderPage {
  const page = record(isRecord(response.page) ? response.page : response._page);
  const rawEvents = array(record(response._embedded).events);
  const events = rawEvents.map(mapTicketmasterEvent).filter((event): event is EventEntry => event !== null);
  return {
    events,
    page: number(page.number) ?? requestedPage,
    totalPages: Math.min(number(page.totalPages) ?? 1, Math.ceil(MAX_PAGE_OFFSET / requestedSize)),
    totalElements: number(page.totalElements) ?? events.length,
  };
}

async function requestTicketmaster(url: URL): Promise<TicketmasterEventsResponse> {
  const apiKey = process.env.TICKETMASTER_API_KEY?.trim();
  if (!apiKey) throw new ProviderError("Ticketmaster event service is not configured.", 500, "configuration");
  url.searchParams.set("apikey", apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
  } catch {
    throw new ProviderError(controller.signal.aborted ? "Ticketmaster request timed out." : "Ticketmaster could not be reached.", 502, "network");
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
    const message = response.status === 401 || response.status === 403 ? "Ticketmaster authentication failed."
      : response.status === 404 ? "Ticketmaster event was not found."
        : response.status === 429 ? "Ticketmaster rate limit reached. Try again shortly."
          : statusCode === 502 ? "Ticketmaster is temporarily unavailable." : "Ticketmaster rejected the event request.";
    throw new ProviderError(message, statusCode, "upstream", response.status);
  }
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload)) throw new Error("Invalid response");
    return payload as TicketmasterEventsResponse;
  } catch {
    throw new ProviderError("Ticketmaster returned an invalid response.", 502, "invalid-response", response.status);
  }
}

function assertApiKeyConfigured(): void {
  if (!process.env.TICKETMASTER_API_KEY?.trim()) {
    throw new ProviderError("Ticketmaster event service is not configured.", 500, "configuration");
  }
}

function buildUrl(filters: EventSearchQuery): URL {
  const url = new URL(DISCOVERY_URL);
  const params = url.searchParams;
  const options = filters.providerOptions.ticketmaster ?? {};
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.city) params.set("city", filters.city);
  if (filters.countryCode) params.set("countryCode", filters.countryCode);
  if (filters.postalCode) params.set("postalCode", filters.postalCode);
  if (filters.latlong) params.set("latlong", filters.latlong);
  if (filters.radius !== undefined) params.set("radius", String(filters.radius));
  params.set("unit", filters.unit);
  params.set("classificationName", options.classificationName ?? "Music");
  if (options.genreId) params.set("genreId", options.genreId);
  if (filters.startDateTime) params.set("startDateTime", filters.startDateTime);
  if (filters.endDateTime) params.set("endDateTime", filters.endDateTime);
  params.set("page", String(filters.page));
  params.set("size", String(filters.size));
  params.set("sort", filters.sort);
  return url;
}

function applyLegacyFilters(page: ProviderPage, filters: EventSearchQuery): ProviderPage {
  const options = filters.providerOptions.ticketmaster ?? {};
  const events = page.events.filter((event) => {
    if (options.type && event.type !== options.type) return false;
    if (options.genre && !event.genres.some((genre) => genre.toLowerCase() === options.genre.toLowerCase())) return false;
    if (filters.localStartDate && event.date < filters.localStartDate) return false;
    if (filters.localEndDate && event.date > filters.localEndDate) return false;
    return true;
  });
  return { ...page, events };
}

export async function searchTicketmasterEvents(filters: EventSearchQuery): Promise<ProviderPage> {
  assertApiKeyConfigured();
  const url = buildUrl(filters);
  const key = url.toString();
  const cached = searchCache.get(key);
  let upstreamPage: ProviderPage;
  if (cached && !isExpired(cached.expiresAt)) {
    upstreamPage = cached.value;
  } else {
    if (cached) searchCache.delete(key);
    const response = await requestTicketmaster(url);
    upstreamPage = fromResponsePage(response, filters.page, filters.size);
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
  const sourceId = id;
  const cacheKey = `event:${sourceId}`;
  const cached = eventCache.get(cacheKey);
  if (cached && !isExpired(cached.expiresAt)) return cached.value;
  if (cached) eventCache.delete(cacheKey);
  const url = new URL(`https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(sourceId)}.json`);
  const response = await requestTicketmaster(url);
  const event = mapTicketmasterEvent(response);
  if (!event) throw new ProviderError("Ticketmaster event data was incomplete.", 502, "invalid-response");
  eventCache.set(cacheKey, { value: event, expiresAt: Date.now() + CACHE_TTL_MS });
  return event;
}