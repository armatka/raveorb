import type { DiscoveryLocation } from "../types/event";
import { eventsDataMode } from "../services/eventsRepository";

const TORONTO = "Toronto";

export const DEFAULT_DISCOVERY_RADIUS_KM = 50;
export const DISCOVERY_RADIUS_OPTIONS = [10, 25, 50, 100] as const;
export type DiscoveryRadiusKm = (typeof DISCOVERY_RADIUS_OPTIONS)[number];

export const DEFAULT_DISCOVERY_LOCATION: DiscoveryLocation = {
  label: TORONTO,
  city: TORONTO,
  countryCode: "CA",
  latitude: 43.6532,
  longitude: -79.3832,
  timezone: "America/Toronto",
};

export const PRESET_DISCOVERY_LOCATIONS: DiscoveryLocation[] = [
  DEFAULT_DISCOVERY_LOCATION,
  {
    label: "Montreal",
    city: "Montreal",
    countryCode: "CA",
    region: "Quebec",
    latitude: 45.5019,
    longitude: -73.5674,
    timezone: "America/Toronto",
  },
  {
    label: "Vancouver",
    city: "Vancouver",
    countryCode: "CA",
    region: "British Columbia",
    latitude: 49.2827,
    longitude: -123.1207,
    timezone: "America/Vancouver",
  },
  {
    label: "New York",
    city: "New York",
    countryCode: "US",
    region: "New York",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
  },
  {
    label: "London",
    city: "London",
    countryCode: "GB",
    region: "England",
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: "Europe/London",
  },
  {
    label: "Berlin",
    city: "Berlin",
    countryCode: "DE",
    latitude: 52.52,
    longitude: 13.405,
    timezone: "Europe/Berlin",
  },
];

export type DiscoveryLocationQuery = {
  city?: string;
  countryCode?: string;
  latlong?: string;
  radius?: number;
  unit?: "km";
};

export function discoveryLocationToQuery(
  location: DiscoveryLocation | null,
  radiusKm: DiscoveryRadiusKm = DEFAULT_DISCOVERY_RADIUS_KM,
): DiscoveryLocationQuery {
  if (!location) return { countryCode: DEFAULT_DISCOVERY_LOCATION.countryCode, unit: "km" };
  if (typeof location.latitude === "number" && typeof location.longitude === "number") {
    return {
      latlong: `${location.latitude},${location.longitude}`,
      radius: radiusKm,
      unit: "km",
    };
  }
  return { city: location.city, countryCode: location.countryCode, unit: "km" };
}

export async function loadDiscoveryLocation(): Promise<DiscoveryLocation | null> {
  const { preferencesStorage } = await import("./preferencesStorage");
  const preferences = await preferencesStorage.get();
  return preferences.discoveryLocationConfigured ? preferences.discoveryLocation : DEFAULT_DISCOVERY_LOCATION;
}

export function discoveryEventsQuery(
  location: DiscoveryLocation | null,
  radiusKm: DiscoveryRadiusKm = DEFAULT_DISCOVERY_RADIUS_KM,
) {
  return {
    ...discoveryLocationToQuery(location, radiusKm),
    ...(eventsDataMode === "mock" && location ? { city: location.city } : {}),
  };
}

export function isSameDiscoveryLocation(first: DiscoveryLocation, second: DiscoveryLocation): boolean {
  const normalize = (value: string | undefined) => value?.trim().toLocaleLowerCase() ?? "";
  return normalize(first.city) === normalize(second.city)
    && normalize(first.region) === normalize(second.region)
    && normalize(first.countryCode) === normalize(second.countryCode);
}

export async function loadDiscoverySettings() {
  const { preferencesStorage } = await import("./preferencesStorage");
  const preferences = await preferencesStorage.get();
  return {
    ...preferences,
    location: preferences.discoveryLocation,
  };
}

export function allDiscoveryLocationsLabel(): string {
  const countryCode = DEFAULT_DISCOVERY_LOCATION.countryCode;
  const fallbackNames: Record<string, string> = {
    CA: "Canada",
    US: "United States",
    GB: "United Kingdom",
    DE: "Germany",
  };
  let countryName: string | undefined;
  try {
    countryName = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode);
  } catch {
    countryName = undefined;
  }
  return `All of ${countryName ?? fallbackNames[countryCode] ?? countryCode}`;
}

export function discoveryLocationFromCity(cityInput: string, fallbackCountryCode = DEFAULT_DISCOVERY_LOCATION.countryCode): DiscoveryLocation {
  const input = cityInput.trim();
  const preset = PRESET_DISCOVERY_LOCATIONS.find((location) => location.city.toLocaleLowerCase() === input.toLocaleLowerCase());
  if (preset) return preset;

  const countryMatch = /,\s*([a-z]{2})$/i.exec(input);
  const city = countryMatch ? input.slice(0, countryMatch.index).trim() : input;
  return {
    label: city,
    city,
    countryCode: countryMatch?.[1].toUpperCase() ?? fallbackCountryCode,
  };
}

export function hasDiscoveryCoordinates(location: DiscoveryLocation | null): boolean {
  return typeof location?.latitude === "number" && typeof location.longitude === "number";
}
