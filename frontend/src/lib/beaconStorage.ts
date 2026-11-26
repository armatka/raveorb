import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SetTime } from "./beacon";

export type BeaconDetails = { sets: SetTime[]; meetingSpot: string };
// Keep the legacy key so existing set times and meeting spots remain available.
const prefix = "raveorb.night-of.v1.";
const queues = new Map<string, Promise<void>>();

export const beaconStorage = {
  async get(eventId: string): Promise<BeaconDetails | null> {
    const key = prefix + eventId;
    await queues.get(key);
    const value = await AsyncStorage.getItem(key);
    if (value === null) return null;
    let data: unknown;
    try { data = JSON.parse(value); } catch { throw new Error("Beacon details could not be read."); }
    if (!data || typeof data !== "object" || !("sets" in data) || !Array.isArray(data.sets)
      || !data.sets.every((set: unknown) => set && typeof set === "object" && "artist" in set && typeof set.artist === "string" && "time" in set && typeof set.time === "string")
      || !("meetingSpot" in data) || typeof data.meetingSpot !== "string") {
      throw new Error("Beacon details contain unsupported records.");
    }
    return { sets: data.sets, meetingSpot: data.meetingSpot };
  },
  async set(eventId: string, details: BeaconDetails): Promise<void> {
    const key = prefix + eventId;
    const write = (queues.get(key) ?? Promise.resolve()).then(() => AsyncStorage.setItem(key, JSON.stringify(details)));
    const settled = write.then(() => undefined, () => undefined);
    queues.set(key, settled);
    try { await write; } finally { if (queues.get(key) === settled) queues.delete(key); }
  },
  async remove(eventId: string): Promise<void> {
    const key = prefix + eventId;
    const write = (queues.get(key) ?? Promise.resolve()).then(() => AsyncStorage.removeItem(key));
    const settled = write.then(() => undefined, () => undefined);
    queues.set(key, settled);
    try { await write; } finally { if (queues.get(key) === settled) queues.delete(key); }
  },
};