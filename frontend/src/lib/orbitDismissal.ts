import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "raveorb.orbit.dismissed-year.v1";
const LEGACY_KEY = "raveorb.wrapped.dismissed-year.v1";
let queue: Promise<void> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

export const orbitDismissal = {
  get: () => enqueue(async () => {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored !== null) return stored;
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy !== null) await AsyncStorage.setItem(KEY, legacy);
    return legacy;
  }),
  dismiss: (year: string) => enqueue(() => AsyncStorage.setItem(KEY, year)),
};
