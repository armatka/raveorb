import type { CitySearchResult } from "../types/event";
import { hasEventsApi, requestEventsApi } from "./eventsApi";

export function isLocationSearchQuery(query: string): boolean {
  const length = query.trim().length;
  return length >= 2 && length <= 80;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapLocation(value: unknown): CitySearchResult {
  if (!isRecord(value)) {
    throw new Error("City search returned an invalid response.");
  }
  const item = value;
  if (typeof item.id !== "string" || !item.id
    || typeof item.city !== "string" || !item.city.trim()
    || typeof item.label !== "string" || !item.label.trim()
    || typeof item.countryCode !== "string" || !/^[A-Z]{2}$/.test(item.countryCode)
    || typeof item.latitude !== "number" || !Number.isFinite(item.latitude) || Math.abs(item.latitude) > 90
    || typeof item.longitude !== "number" || !Number.isFinite(item.longitude) || Math.abs(item.longitude) > 180
    || [item.region, item.country, item.timezone].some((field) => field !== undefined && typeof field !== "string")
    || (item.population !== undefined && (typeof item.population !== "number" || !Number.isFinite(item.population) || item.population < 0))) {
    throw new Error("City search returned an invalid response.");
  }
  return {
    id: item.id,
    label: item.label,
    city: item.city,
    countryCode: item.countryCode,
    latitude: item.latitude,
    longitude: item.longitude,
    ...(typeof item.region === "string" ? { region: item.region } : {}),
    ...(typeof item.country === "string" ? { country: item.country } : {}),
    ...(typeof item.timezone === "string" ? { timezone: item.timezone } : {}),
    ...(typeof item.population === "number" ? { population: item.population } : {}),
  };
}

export async function searchLocations(query: string): Promise<CitySearchResult[]> {
  if (!isLocationSearchQuery(query)) throw new Error("Enter a city name between 2 and 80 characters.");
  if (!hasEventsApi()) throw new Error("City search needs a configured API URL.");
  const { payload } = await requestEventsApi(`/api/locations/search?${new URLSearchParams({ q: query.trim() })}`);
  if (!Array.isArray(payload)) throw new Error("City search returned an invalid response.");
  return payload.map(mapLocation);
}
