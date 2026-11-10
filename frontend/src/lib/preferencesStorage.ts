import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppPreferences = {
  discoveryCity: string | null;
};

const STORAGE_KEY = "raveorb.preferences.v1";
let writeQueue: Promise<void> = Promise.resolve();

async function readPreferences(): Promise<Record<string, unknown>> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === null) return {};
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
  if (preferences.discoveryCity !== undefined && preferences.discoveryCity !== null
    && (typeof preferences.discoveryCity !== "string" || !preferences.discoveryCity.trim())) {
    throw new Error("Discovery location is invalid.");
  }
  return preferences;
}

export const preferencesStorage = {
  async get(): Promise<AppPreferences> {
    await writeQueue;
    const stored = await readPreferences();
    return { discoveryCity: typeof stored.discoveryCity === "string" ? stored.discoveryCity : null };
  },

  async setDiscoveryCity(city: string | null): Promise<void> {
    if (city !== null && !city.trim()) throw new Error("Discovery location is invalid.");
    const write = writeQueue.then(async () => {
      const current = await readPreferences();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, discoveryCity: city }));
    });
    writeQueue = write.catch(() => undefined);
    return write;
  },
};