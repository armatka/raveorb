import { useSyncExternalStore } from "react";

type Overrides = Readonly<{ forceWindow: boolean; forceAfterEvent: boolean }>;
const defaults: Overrides = Object.freeze({ forceWindow: false, forceAfterEvent: false });
let overrides = defaults;
const listeners = new Set<() => void>();

export function getBeaconDevOverrides(): Overrides {
  return typeof __DEV__ !== "undefined" && __DEV__ ? overrides : defaults;
}

export function setBeaconDevOverride(key: keyof Overrides, value: boolean): void {
  if (typeof __DEV__ === "undefined" || !__DEV__ || overrides[key] === value) return;
  overrides = Object.freeze({ ...overrides, [key]: value });
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useBeaconDevOverrides(): Overrides {
  return useSyncExternalStore(subscribe, getBeaconDevOverrides, getBeaconDevOverrides);
}
