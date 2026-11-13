import { mockEvents, mockVenues } from "../data/mockData";
import type { EventEntry, EventCurrency, EventStatus, EventType, RaveOrbCategory } from "../types/event";
import { raveOrbCategories } from "../types/event";
import type { Venue } from "../types/venue";
import { getEventsApiBaseUrl, hasEventsApi, readPageHeader, requestEventsApi, serializeEventsQuery, type EventsApiQuery } from "./eventsApi";

export type EventQueryFilters = {
  city?: string;
  genre?: string;
  type?: EventType;
  startDate?: string;
  endDate?: string;
  search?: string;
  countryCode?: string;
  postalCode?: string;
  latlong?: string;
  radius?: number;
  unit?: "km" | "miles";
  classificationName?: string;
  genreId?: string;
  startDateTime?: string;
  endDateTime?: string;
  page?: number;
  size?: number;
  sort?: string;
  electronicOnly?: boolean;
};

export type EventsDataMode = "api" | "mock";
export type EventSearchPage = { events: EventEntry[]; page: number; totalPages: number; totalElements: number };

const apiBaseUrl = getEventsApiBaseUrl();

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
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function isEventStatus(value: unknown): value is EventStatus {
  return value === "scheduled" || value === "cancelled" || value === "postponed" || value === "sold-out";
}

function isRaveOrbCategory(value: unknown): value is RaveOrbCategory {
  return typeof value === "string" && raveOrbCategories.some((category) => category === value);
}

function isOptionalStringArray(value: unknown): boolean {
  return value === undefined || isStringArray(value);
}

function isTicketmasterClassification(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ["segment", "genre", "subGenre", "type", "subType"].every((key) => {
    const item = value[key];
    return item === undefined || (isRecord(item)
      && (item.id === undefined || typeof item.id === "string")
      && (item.name === undefined || typeof item.name === "string"));
  });
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
    && isOptionalString(value.segment)
    && isOptionalString(value.genre)
    && isOptionalString(value.subgenre)
    && (value.classifications === undefined || (Array.isArray(value.classifications) && value.classifications.every(isTicketmasterClassification)))
    && (value.raveOrbCategory === undefined || isRaveOrbCategory(value.raveOrbCategory))
    && (value.raveOrbSubgenre === undefined || value.raveOrbSubgenre === null || typeof value.raveOrbSubgenre === "string")
    && (value.electronicScore === undefined || (typeof value.electronicScore === "number" && Number.isFinite(value.electronicScore) && value.electronicScore >= 0 && value.electronicScore <= 100))
    && (value.isElectronic === undefined || typeof value.isElectronic === "boolean")
    && (value.isFestival === undefined || typeof value.isFestival === "boolean")
    && isOptionalStringArray(value.matchedTerms)
    && isOptionalStringArray(value.classificationReasons)
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

function apiQuery(filters: EventQueryFilters): EventsApiQuery {
  return {
    keyword: filters.search,
    city: filters.city,
    countryCode: filters.countryCode,
    postalCode: filters.postalCode,
    latlong: filters.latlong,
    radius: filters.radius,
    unit: filters.unit ?? "km",
    classificationName: filters.classificationName ?? "Music",
    genreId: filters.genreId,
    startDateTime: filters.startDateTime,
    endDateTime: filters.endDateTime,
    page: filters.page ?? 0,
    size: filters.size ?? 20,
    sort: filters.sort ?? "date,asc",
    electronicOnly: filters.electronicOnly,
  };
}

function matchesLegacyFilters(event: EventEntry, filters: EventQueryFilters): boolean {
  const search = filters.search?.trim().toLocaleLowerCase();
  const searchable = [event.title, event.venueName, event.city, ...event.artists, ...event.genres].join(" ").toLocaleLowerCase();
  return (!filters.genre || event.genres.some((genre) => genre.toLocaleLowerCase() === filters.genre?.trim().toLocaleLowerCase()))
    && (!filters.type || event.type === filters.type)
    && (!filters.startDate || event.date >= filters.startDate)
    && (!filters.endDate || event.date <= filters.endDate)
    && (!search || searchable.includes(search));
}

function pageHeader(response: Response, name: string, fallback: number): number {
  return readPageHeader(response, name, fallback);
}

function isNotFound(error: unknown): boolean {
  return error instanceof EventNotFoundError
    || (typeof error === "object" && error !== null && "status" in error && error.status === 404);
}

export class EventNotFoundError extends Error {
  constructor() {
    super("The requested record was not found.");
    this.name = "EventNotFoundError";
  }
}

export const eventsRepository = {
  async listEvents(filters: EventQueryFilters = {}): Promise<EventEntry[]> {
    const result = await this.listEventsPage({ ...filters, page: filters.page ?? 0, size: filters.size ?? 50 });
    return result.events;
  },

  async listEventsPage(filters: EventQueryFilters = {}): Promise<EventSearchPage> {
    validateFilters(filters);
    const page = filters.page ?? 0;
    const size = filters.size ?? 20;
    if (!Number.isInteger(page) || page < 0) throw new Error("Event page must be a non-negative integer.");
    if (!Number.isInteger(size) || size < 1 || size > 50) throw new Error("Event page size must be between 1 and 50.");
    if (!hasEventsApi()) {
      const all = filteredMockEvents(filters);
      return { events: all.slice(page * size, (page + 1) * size), page, totalPages: Math.max(1, Math.ceil(all.length / size)), totalElements: all.length };
    }
    const { payload, response } = await requestEventsApi(`/api/events${serializeEventsQuery(apiQuery({ ...filters, page, size }))}`);
    const events = parseEvents(payload).filter((event) => matchesLegacyFilters(event, filters));
    return {
      events,
      page: pageHeader(response, "X-Page", page),
      totalPages: pageHeader(response, "X-Total-Pages", 1),
      totalElements: pageHeader(response, "X-Total-Elements", events.length),
    };
  },

  async getEvent(id: string): Promise<EventEntry | null> {
    if (!hasEventsApi()) return mockEvents.find((event) => event.id === id) ?? null;
    try {
      const { payload } = await requestEventsApi(`/api/events/${encodeURIComponent(id)}`);
      return parseEvent(payload);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  async listVenues(): Promise<Venue[]> {
    if (!hasEventsApi()) return [...mockVenues];
    const { payload } = await requestEventsApi("/api/venues");
    return parseVenues(payload);
  },

  async getVenue(id: string): Promise<Venue | null> {
    if (!hasEventsApi()) return mockVenues.find((venue) => venue.id === id) ?? null;
    try {
      const { payload } = await requestEventsApi(`/api/venues/${encodeURIComponent(id)}`);
      return parseVenue(payload);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },
};
