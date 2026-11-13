import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_DISCOVERY_LOCATION,
  DEFAULT_DISCOVERY_RADIUS_KM,
  DISCOVERY_RADIUS_OPTIONS,
  isSameDiscoveryLocation,
  type DiscoveryRadiusKm,
} from "./discoveryLocation";
import type { DiscoveryDateRange } from "./eventDiscovery";
import { raveOrbCategories, type DiscoveryLocation, type RaveOrbCategory } from "../types/event";

export type AppPreferences = {
  discoveryLocation: DiscoveryLocation | null;
  discoveryLocationConfigured: boolean;
  savedLocations: DiscoveryLocation[];
  favouriteCategories: RaveOrbCategory[];
  radiusKm: DiscoveryRadiusKm;
  defaultDateRange: DiscoveryDateRange;
};

const STORAGE_KEY = "raveorb.preferences.v2";
const LEGACY_STORAGE_KEY = "raveorb.preferences.v1";
const DEFAULT_DATE_RANGE: DiscoveryDateRange = "all-upcoming";
const DISCOVERY_DATE_RANGES: DiscoveryDateRange[] = ["tonight", "weekend", "next-7-days", "next-30-days", "all-upcoming"];
let writeQueue: Promise<void> = Promise.resolve();

function parsePreferences(stored: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error("Preferences could not be read.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Preferences contain unsupported data.");
  }
  const preferences = parsed as Record<string, unknown>;
  if (preferences.discoveryLocation !== undefined && preferences.discoveryLocation !== null) {
    const location = preferences.discoveryLocation;
    if (!isDiscoveryLocation(location)) throw new Error("Discovery location is invalid.");
  }
  return preferences;
}

function isDiscoveryLocation(value: unknown): value is DiscoveryLocation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const location = value as Record<string, unknown>;
  return typeof location.label === "string" && Boolean(location.label.trim())
    && typeof location.city === "string" && Boolean(location.city.trim())
    && typeof location.countryCode === "string" && /^[A-Z]{2}$/.test(location.countryCode)
    && (location.region === undefined || typeof location.region === "string")
    && (location.timezone === undefined || typeof location.timezone === "string")
    && (location.latitude === undefined || (typeof location.latitude === "number" && Number.isFinite(location.latitude)))
    && (location.longitude === undefined || (typeof location.longitude === "number" && Number.isFinite(location.longitude)));
}

function isSavedLocations(value: unknown): value is DiscoveryLocation[] {
  return Array.isArray(value) && value.length <= 5 && value.every(isDiscoveryLocation)
    && value.every((location, index) => !value.slice(0, index).some((previous) => isSameDiscoveryLocation(previous, location)));
}

function isFavouriteCategories(value: unknown): value is RaveOrbCategory[] {
  return Array.isArray(value) && value.every((category) => raveOrbCategories.includes(category as RaveOrbCategory))
    && new Set(value).size === value.length;
}

function isRadiusKm(value: unknown): value is DiscoveryRadiusKm {
  return typeof value === "number" && DISCOVERY_RADIUS_OPTIONS.includes(value as DiscoveryRadiusKm);
}

function isDateRange(value: unknown): value is DiscoveryDateRange {
  return typeof value === "string" && DISCOVERY_DATE_RANGES.includes(value as DiscoveryDateRange);
}

async function readPreferences(): Promise<Record<string, unknown>> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored !== null) return parsePreferences(stored);

  const legacyStored = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyStored === null) return {};
  const legacy = parsePreferences(legacyStored);
  const migrated: Record<string, unknown> = { ...legacy };
  if (Object.prototype.hasOwnProperty.call(legacy, "discoveryCity")) {
    const city = legacy.discoveryCity;
    if (city !== null && (typeof city !== "string" || !city.trim())) {
      throw new Error("Discovery location is invalid.");
    }
    migrated.discoveryLocation = typeof city === "string"
      ? { label: city.trim(), city: city.trim(), countryCode: DEFAULT_DISCOVERY_LOCATION.countryCode }
      : null;
    delete migrated.discoveryCity;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}

export const preferencesStorage = {
  async get(): Promise<AppPreferences> {
    await writeQueue;
    const stored = await readPreferences();
    return {
      discoveryLocation: isDiscoveryLocation(stored.discoveryLocation) ? stored.discoveryLocation : null,
      discoveryLocationConfigured: Object.prototype.hasOwnProperty.call(stored, "discoveryLocation"),
      savedLocations: isSavedLocations(stored.savedLocations) ? stored.savedLocations : [],
      favouriteCategories: isFavouriteCategories(stored.favouriteCategories) ? stored.favouriteCategories : [],
      radiusKm: isRadiusKm(stored.radiusKm) ? stored.radiusKm : DEFAULT_DISCOVERY_RADIUS_KM,
      defaultDateRange: isDateRange(stored.defaultDateRange) ? stored.defaultDateRange : DEFAULT_DATE_RANGE,
    };
  },

  async setDiscoveryLocation(location: DiscoveryLocation | null): Promise<void> {
    if (location !== null && !isDiscoveryLocation(location)) throw new Error("Discovery location is invalid.");
    return updatePreferences({ discoveryLocation: location });
  },

  async setSavedLocations(locations: DiscoveryLocation[]): Promise<void> {
    if (!isSavedLocations(locations)) throw new Error("Saved locations are invalid.");
    return updatePreferences({ savedLocations: locations });
  },

  async setFavouriteCategories(categories: RaveOrbCategory[]): Promise<void> {
    if (!isFavouriteCategories(categories)) throw new Error("Favourite styles are invalid.");
    return updatePreferences({ favouriteCategories: categories });
  },

  async setRadiusKm(radiusKm: DiscoveryRadiusKm): Promise<void> {
    if (!isRadiusKm(radiusKm)) throw new Error("Discovery radius is invalid.");
    return updatePreferences({ radiusKm });
  },

  async setDefaultDateRange(defaultDateRange: DiscoveryDateRange): Promise<void> {
    if (!isDateRange(defaultDateRange)) throw new Error("Default date range is invalid.");
    return updatePreferences({ defaultDateRange });
  },
};

function updatePreferences(updates: Record<string, unknown>): Promise<void> {
  const write = writeQueue.then(async () => {
    const current = await readPreferences();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...updates }));
  });
  writeQueue = write.catch(() => undefined);
  return write;
}