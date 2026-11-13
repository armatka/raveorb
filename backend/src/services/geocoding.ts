import type { CitySearchResult } from "../types/index.js";

const SEARCH_URL = "https://geocoding-api.open-meteo.com/v1/search";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const REQUEST_TIMEOUT_MS = 8_000;
const cache = new Map<string, { expiresAt: number; value: CitySearchResult[] }>();

export class GeocodingQueryError extends Error {}

export class GeocodingError extends Error {
  constructor(readonly kind: "network" | "upstream" | "invalid-response") {
    super("City search is temporarily unavailable. Please try again.");
    this.name = "GeocodingError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function coordinate(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= maximum;
}

function mapCity(value: unknown): CitySearchResult | null {
  if (!isRecord(value)) return null;
  const city = text(value.name);
  const countryCode = text(value.country_code)?.toUpperCase();
  if (!city || !countryCode || !/^[A-Z]{2}$/.test(countryCode)
    || !coordinate(value.latitude, 90) || !coordinate(value.longitude, 180)
    || typeof value.id !== "number" || !Number.isSafeInteger(value.id)) return null;
  const region = text(value.admin1);
  const country = text(value.country);
  return {
    id: String(value.id),
    label: [city, region, country].filter(Boolean).join(", "),
    city,
    region,
    country,
    countryCode,
    latitude: value.latitude,
    longitude: value.longitude,
    timezone: text(value.timezone),
    population: typeof value.population === "number" && Number.isFinite(value.population) && value.population >= 0
      ? value.population : undefined,
  };
}

export async function searchCities(query: string, limit = 8): Promise<CitySearchResult[]> {
  const name = query.trim();
  if (name.length < 2 || name.length > 80) {
    throw new GeocodingQueryError("Enter a city name between 2 and 80 characters.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new GeocodingQueryError("The city result limit must be between 1 and 100.");
  }
  const key = JSON.stringify([name.toLowerCase(), limit]);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value.map((city) => ({ ...city }));
  if (cached) cache.delete(key);

  const url = new URL(SEARCH_URL);
  url.searchParams.set("name", name);
  url.searchParams.set("count", String(limit));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new GeocodingError("upstream");
    const payload: unknown = await response.json();
    if (!isRecord(payload) || payload.error
      || (payload.results !== undefined && !Array.isArray(payload.results))) {
      throw new GeocodingError("invalid-response");
    }
    const results: unknown[] = payload.results ?? [];
    const cities = results.map(mapCity).filter((city): city is CitySearchResult => city !== null).slice(0, limit);
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: cities });
    return cities.map((city) => ({ ...city }));
  } catch (error) {
    if (error instanceof GeocodingError) throw error;
    throw new GeocodingError(error instanceof SyntaxError ? "invalid-response" : "network");
  } finally {
    clearTimeout(timeout);
  }
}
