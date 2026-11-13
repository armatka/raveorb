import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_DISCOVERY_LOCATION } from "./discoveryLocation";
import type { DiscoveryLocation } from "../types/event";

export type AppPreferences = {
  discoveryLocation: DiscoveryLocation | null;
  discoveryLocationConfigured: boolean;
};

const STORAGE_KEY = "raveorb.preferences.v2";
const LEGACY_STORAGE_KEY = "raveorb.preferences.v1";
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
    };
  },

  async setDiscoveryLocation(location: DiscoveryLocation | null): Promise<void> {
    if (location !== null && !isDiscoveryLocation(location)) throw new Error("Discovery location is invalid.");
    const write = writeQueue.then(async () => {
      const current = await readPreferences();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, discoveryLocation: location }));
    });
    writeQueue = write.catch(() => undefined);
    return write;
  },
};