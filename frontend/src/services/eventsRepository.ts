import { mockEvents, mockVenues } from "../data/mockData";
import type { EventEntry, EventCurrency, EventStatus, EventType } from "../types/event";
import type { Venue } from "../types/venue";

export type EventQueryFilters = {
  city?: string;
  genre?: string;
  type?: EventType;
  startDate?: string;
  endDate?: string;
  search?: string;
};

export type EventsDataMode = "api" | "mock";

const REQUEST_TIMEOUT_MS = 10_000;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ?? "";

export const eventsDataMode: EventsDataMode = apiBaseUrl ? "api" : "mock";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEventType(value: unknown): value is EventType {
  return value === "festival" || value === "rave" || value === "concert" || value === "club";
}

function isEventCurrency(value: unknown): value is EventCurrency {
  return value === "CAD" || value === "USD" || value === "EUR";
}

function isEventStatus(value: unknown): value is EventStatus {
  return value === "scheduled" || value === "cancelled" || value === "postponed" || value === "sold-out";
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isEventEntry(value: unknown): value is EventEntry {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.title === "string"
    && isEventType(value.type)
    && typeof value.venueId === "string"
    && typeof value.venueName === "string"
    && typeof value.city === "string"
    && typeof value.countryCode === "string"
    && isOptionalString(value.address)
    && isOptionalNumber(value.latitude)
    && isOptionalNumber(value.longitude)
    && typeof value.date === "string"
    && typeof value.startTime === "string"
    && typeof value.endTime === "string"
    && typeof value.timezone === "string"
    && isStringArray(value.artists)
    && isStringArray(value.genres)
    && typeof value.description === "string"
    && isOptionalString(value.imageUrl)
    && isOptionalString(value.ticketUrl)
    && isOptionalString(value.eventUrl)
    && isOptionalNumber(value.priceMin)
    && isOptionalNumber(value.priceMax)
    && (value.currency === undefined || isEventCurrency(value.currency))
    && typeof value.source === "string"
    && isOptionalString(value.sourceEventId)
    && isOptionalString(value.ageRestriction)
    && (value.status === undefined || isEventStatus(value.status));
}

function isVenue(value: unknown): value is Venue {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.city === "string"
    && isOptionalString(value.countryCode)
    && isOptionalString(value.address)
    && isOptionalNumber(value.latitude)
    && isOptionalNumber(value.longitude)
    && typeof value.type === "string"
    && typeof value.visits === "number"
    && typeof value.favoriteGenre === "string";
}

async function requestJson(path: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The event service timed out. Check your connection and retry.");
    }
    throw new Error("The event service could not be reached. Check the API URL and connection.", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponse<T>(response: Response, parse: (value: unknown) => T): Promise<T> {
  if (!response.ok) {
    if (response.status === 404) throw new EventNotFoundError();
    throw new Error(`The event service returned an error (${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("The event service returned invalid JSON.", { cause: error });
  }
  return parse(payload);
}

function parseEvents(value: unknown): EventEntry[] {
  if (!Array.isArray(value) || !value.every(isEventEntry)) {
    throw new Error("The event service returned an invalid events response.");
  }
  return value;
}

function parseVenues(value: unknown): Venue[] {
  if (!Array.isArray(value) || !value.every(isVenue)) {
    throw new Error("The event service returned an invalid venues response.");
  }
  return value;
}

function parseEvent(value: unknown): EventEntry {
  if (!isEventEntry(value)) throw new Error("The event service returned an invalid event response.");
  return value;
}

function parseVenue(value: unknown): Venue {
  if (!isVenue(value)) throw new Error("The event service returned an invalid venue response.");
  return value;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateFilters(filters: EventQueryFilters): void {
  if (filters.type !== undefined && !isEventType(filters.type)) {
    throw new Error("Invalid event type filter.");
  }
  if (filters.startDate !== undefined && !isDate(filters.startDate)) {
    throw new Error("Start date must use YYYY-MM-DD format.");
  }
  if (filters.endDate !== undefined && !isDate(filters.endDate)) {
    throw new Error("End date must use YYYY-MM-DD format.");
  }
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    throw new Error("Start date must not be later than end date.");
  }
}

function matchesFilters(event: EventEntry, filters: EventQueryFilters): boolean {
  const city = filters.city?.trim().toLocaleLowerCase();
  const genre = filters.genre?.trim().toLocaleLowerCase();
  const search = filters.search?.trim().toLocaleLowerCase();
  if (city && event.city.toLocaleLowerCase() !== city) return false;
  if (genre && !event.genres.some((item) => item.toLocaleLowerCase() === genre)) return false;
  if (filters.type && event.type !== filters.type) return false;
  if (filters.startDate && event.date < filters.startDate) return false;
  if (filters.endDate && event.date > filters.endDate) return false;
  if (search) {
    const searchable = [event.title, event.venueName, event.city, ...event.artists, ...event.genres]
      .join(" ")
      .toLocaleLowerCase();
    if (!searchable.includes(search)) return false;
  }
  return true;
}

function filteredMockEvents(filters: EventQueryFilters): EventEntry[] {
  return mockEvents.filter((event) => matchesFilters(event, filters));
}

function queryString(filters: EventQueryFilters): string {
  const params = new URLSearchParams();
  for (const key of ["city", "genre", "type", "startDate", "endDate", "search"] as const) {
    const value = filters[key]?.trim();
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export class EventNotFoundError extends Error {
  constructor() {
    super("The requested record was not found.");
    this.name = "EventNotFoundError";
  }
}

export const eventsRepository = {
  async listEvents(filters: EventQueryFilters = {}): Promise<EventEntry[]> {
    validateFilters(filters);
    if (!apiBaseUrl) return filteredMockEvents(filters);
    const response = await requestJson(`/api/events${queryString(filters)}`);
    return parseResponse(response, parseEvents);
  },

  async getEvent(id: string): Promise<EventEntry | null> {
    if (!apiBaseUrl) return mockEvents.find((event) => event.id === id) ?? null;
    try {
      const response = await requestJson(`/api/events/${encodeURIComponent(id)}`);
      return await parseResponse(response, parseEvent);
    } catch (error) {
      if (error instanceof EventNotFoundError) return null;
      throw error;
    }
  },

  async listVenues(): Promise<Venue[]> {
    if (!apiBaseUrl) return [...mockVenues];
    const response = await requestJson("/api/venues");
    return parseResponse(response, parseVenues);
  },

  async getVenue(id: string): Promise<Venue | null> {
    if (!apiBaseUrl) return mockVenues.find((venue) => venue.id === id) ?? null;
    try {
      const response = await requestJson(`/api/venues/${encodeURIComponent(id)}`);
      return await parseResponse(response, parseVenue);
    } catch (error) {
      if (error instanceof EventNotFoundError) return null;
      throw error;
    }
  },
};
