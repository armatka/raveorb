import type { EventEntry } from "../types/index.js";

export type EventSearchQuery = {
  keyword?: string;
  city?: string;
  countryCode?: string;
  postalCode?: string;
  latlong?: string;
  radius?: number;
  unit: "km" | "miles";
  startDateTime?: string;
  endDateTime?: string;
  localStartDate?: string;
  localEndDate?: string;
  page: number;
  size: number;
  sort: string;
  electronicOnly?: boolean;
  providerOptions: Record<string, Record<string, string>>;
};

export type ProviderPage = {
  events: EventEntry[];
  page: number;
  totalPages: number;
  totalElements: number;
};

export class EventQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventQueryError";
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly kind: "configuration" | "upstream" | "network" | "invalid-response",
    readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface EventProvider {
  id: string;
  displayName: string;
  // Ticketmaster retains raw IDs for existing saved data; all other providers must
  // return event IDs prefixed with `${id}-` and set sourceEventId to the raw ID.
  search(query: EventSearchQuery): Promise<ProviderPage>;
  getById(sourceEventId: string): Promise<EventEntry | null>;
  isConfigured(): boolean;
  queryKeys?: readonly string[];
  parseQuery?(value: (key: string) => string | undefined): Record<string, string>;
}
