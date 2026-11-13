import { EventQueryError, ProviderError, type EventProvider, type EventSearchQuery, type ProviderPage } from "../providers/types.js";
import { providers } from "../providers/registry.js";
import type { EventEntry } from "../types/index.js";
import { classifyElectronicEvent } from "./electronicClassification.js";

export { EventQueryError, ProviderError } from "../providers/types.js";

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime())
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

function singleQueryValue(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new EventQueryError(`${key} must be a single value.`);
  const clean = value.trim();
  if (clean.length > 120) throw new EventQueryError(`${key} must be 120 characters or fewer.`);
  return clean || undefined;
}

function integerQueryValue(value: string | undefined, key: string, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new EventQueryError(`${key} must be a whole number.`);
  const parsed = Number(value);
  if (parsed < min || parsed > max) throw new EventQueryError(`${key} must be between ${min} and ${max}.`);
  return parsed;
}

function validateDateTime(value: string | undefined, key: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new EventQueryError(`${key} must be a valid ISO date-time.`);
  }
  return value;
}

const allowedQueryKeys = new Set([
  "keyword", "search", "city", "countryCode", "postalCode", "latlong", "radius", "unit",
  "startDateTime", "endDateTime", "page", "size", "sort", "startDate", "endDate", "electronicOnly",
  ...providers.flatMap((provider) => provider.queryKeys ?? []),
]);
const validSorts = new Set(["date,asc", "date,desc", "name,asc", "name,desc", "relevance,desc", "distance,asc", "onSaleDate,asc"]);

export function parseEventSearchQuery(query: Record<string, unknown>): EventSearchQuery {
  for (const key of Object.keys(query)) if (!allowedQueryKeys.has(key)) throw new EventQueryError(`Unsupported query parameter: ${key}`);
  const keyword = singleQueryValue(query, "keyword") ?? singleQueryValue(query, "search");
  const city = singleQueryValue(query, "city");
  const rawCountryCode = singleQueryValue(query, "countryCode");
  const postalCode = singleQueryValue(query, "postalCode");
  const latlong = singleQueryValue(query, "latlong");
  if (!rawCountryCode && !latlong) throw new EventQueryError("countryCode is required unless latlong is provided.");
  if (rawCountryCode && !/^[a-z]{2}$/i.test(rawCountryCode)) throw new EventQueryError("countryCode must be a two-letter code.");
  if (latlong) {
    const match = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(latlong);
    if (!match || Math.abs(Number(match[1])) > 90 || Math.abs(Number(match[2])) > 180) throw new EventQueryError("latlong must be valid latitude,longitude coordinates.");
  }
  const radiusText = singleQueryValue(query, "radius");
  let radius: number | undefined;
  if (radiusText !== undefined) {
    radius = Number(radiusText);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 1000) throw new EventQueryError("radius must be greater than 0 and no more than 1000.");
  }
  const unitText = singleQueryValue(query, "unit") ?? "km";
  if (unitText !== "km" && unitText !== "miles") throw new EventQueryError("unit must be km or miles.");
  const providerOptions: EventSearchQuery["providerOptions"] = {};
  for (const provider of providers) {
    if (provider.parseQuery) providerOptions[provider.id] = provider.parseQuery((key) => singleQueryValue(query, key));
  }
  const startDate = singleQueryValue(query, "startDate");
  const endDate = singleQueryValue(query, "endDate");
  if (startDate && !validDate(startDate)) throw new EventQueryError("startDate must be a valid YYYY-MM-DD date.");
  if (endDate && !validDate(endDate)) throw new EventQueryError("endDate must be a valid YYYY-MM-DD date.");
  if (startDate && endDate && startDate > endDate) throw new EventQueryError("startDate must be on or before endDate.");
  const rawSort = singleQueryValue(query, "sort") ?? "date,asc";
  if (!validSorts.has(rawSort)) throw new EventQueryError("sort is not supported.");
  const electronicOnlyText = singleQueryValue(query, "electronicOnly");
  if (electronicOnlyText !== undefined && electronicOnlyText !== "true" && electronicOnlyText !== "false") {
    throw new EventQueryError("electronicOnly must be true or false.");
  }
  return {
    ...(keyword ? { keyword } : {}), ...(city ? { city } : {}), ...(rawCountryCode ? { countryCode: rawCountryCode.toUpperCase() } : {}),
    ...(postalCode ? { postalCode } : {}), ...(latlong ? { latlong: latlong.replace(/\s/g, "") } : {}),
    ...(radius !== undefined ? { radius } : {}), unit: unitText,
    providerOptions,
    ...(validateDateTime(singleQueryValue(query, "startDateTime"), "startDateTime") ? { startDateTime: validateDateTime(singleQueryValue(query, "startDateTime"), "startDateTime") } : startDate ? { startDateTime: `${startDate}T00:00:00Z` } : {}),
    ...(validateDateTime(singleQueryValue(query, "endDateTime"), "endDateTime") ? { endDateTime: validateDateTime(singleQueryValue(query, "endDateTime"), "endDateTime") } : endDate ? { endDateTime: `${endDate}T23:59:59Z` } : {}),
    page: integerQueryValue(singleQueryValue(query, "page"), "page", 0, 0, 100000),
    size: integerQueryValue(singleQueryValue(query, "size"), "size", 20, 1, 50),
    sort: rawSort,
    ...(electronicOnlyText !== undefined ? { electronicOnly: electronicOnlyText === "true" } : {}),
    ...(startDate ? { localStartDate: startDate } : {}), ...(endDate ? { localEndDate: endDate } : {}),
  };
}

function classifyEvent(event: EventEntry): EventEntry {
  const classification = classifyElectronicEvent(event);
  return {
    ...event,
    raveOrbCategory: classification.category,
    raveOrbSubgenre: classification.subgenre,
    electronicScore: classification.electronicScore,
    isElectronic: classification.isElectronic,
    isFestival: classification.isFestival,
    matchedTerms: classification.matchedTerms,
    classificationReasons: classification.classificationReasons,
  };
}

function defaultProvider(available: readonly EventProvider[]): EventProvider {
  const provider = available.find((item) => item.id === "ticketmaster");
  if (!provider) throw new Error("Ticketmaster provider is not registered.");
  return provider;
}

function assertConfigured(provider: EventProvider): void {
  if (!provider.isConfigured()) {
    throw new ProviderError(`${provider.displayName} event service is not configured.`, 500, "configuration");
  }
}

export type EventSearchResult = ProviderPage & { providerErrors: string[] };

export async function searchEvents(query: EventSearchQuery, available: readonly EventProvider[] = providers): Promise<EventSearchResult> {
  const configured = available.filter((provider) => provider.isConfigured());
  if (!configured.length) {
    const provider = defaultProvider(available);
    throw new ProviderError(`${provider.displayName} event service is not configured.`, 500, "configuration");
  }
  const outcomes = await Promise.allSettled(configured.map((provider) => Promise.resolve().then(() => provider.search(query))));
  const pages: ProviderPage[] = [];
  const failures: { provider: EventProvider; error: unknown }[] = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") pages.push(outcome.value);
    else failures.push({ provider: configured[index], error: outcome.reason });
  });
  if (!pages.length) throw failures[0].error;
  for (const { provider, error } of failures) {
    console.error("Event provider request failed", {
      provider: provider.id,
      kind: error instanceof ProviderError ? error.kind : "internal",
      ...(error instanceof ProviderError ? { statusCode: error.statusCode, upstreamStatus: error.upstreamStatus } : {}),
    });
  }
  const eventLists = pages.map((page) => page.events.map(classifyEvent)
    .filter((event) => !query.electronicOnly || event.isElectronic));
  const events = eventLists.flat();
  if (eventLists.filter((list) => list.length > 0).length > 1) {
    const direction = query.sort === "date,desc" ? -1 : 1;
    events.sort((first, second) => direction * (`${first.date}T${first.startTime}`.localeCompare(`${second.date}T${second.startTime}`)));
  }
  const first = pages[0];
  return {
    events,
    page: first.page,
    totalPages: pages.length === 1 ? first.totalPages : Math.max(...pages.map((page) => page.totalPages)),
    totalElements: pages.reduce((total, page) => total + page.totalElements, 0),
    providerErrors: failures.map(({ provider }) => provider.id),
  };
}

export async function getEventById(id: string, available: readonly EventProvider[] = providers): Promise<EventEntry | null> {
  const provider = [...available].sort((a, b) => b.id.length - a.id.length)
    .find((item) => id.startsWith(`${item.id}-`));
  const selected = provider ?? defaultProvider(available);
  if (selected.id !== "submitted") assertConfigured(selected);
  const event = await selected.getById(provider ? id.slice(provider.id.length + 1) : id);
  return event ? classifyEvent(event) : null;
}

export function createEventService(availableProviders: readonly EventProvider[] = providers) {
  return {
    parseEventSearchQuery,
    searchEvents: (query: EventSearchQuery) => searchEvents(query, availableProviders),
    getEventById: (id: string) => getEventById(id, availableProviders),
  };
}

