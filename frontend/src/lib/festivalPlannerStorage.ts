import AsyncStorage from "@react-native-async-storage/async-storage";
import { festivalDays, validFestivalDate, type FestivalPlan, type PlannedSet } from "./festivalPlanner";

const prefix = "raveorb.festival-plan.v1.";
const queues = new Map<string, Promise<void>>();

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parsePlan(value: unknown, eventId: string): FestivalPlan {
  if (!record(value) || (value.version !== 1 && value.version !== 0) || value.eventId !== eventId
    || !record(value.event) || value.event.id !== eventId || typeof value.event.title !== "string"
    || !Array.isArray(value.days) || !value.days.length || !value.days.every((day: unknown) => typeof day === "string" && validFestivalDate(day))
    || !Array.isArray(value.stages) || !value.stages.every((stage: unknown) => typeof stage === "string")
    || !Array.isArray(value.sets) || typeof value.updatedAt !== "string") {
    throw new Error("Festival plan contains unsupported data.");
  }
  const days = [...new Set<string>(value.days)].sort();
  if (days.length !== value.days.length || festivalDays(days[0], days[days.length - 1]).length !== days.length) {
    throw new Error("Festival plan contains unsupported days.");
  }
  const sets: PlannedSet[] = value.sets.map((set: unknown) => {
    if (!record(set) || !["id", "artist", "stage", "day", "start", "end"].every((key) => typeof set[key] === "string")
      || !String(set.id).trim() || !days.includes(String(set.day))
      || !["start", "end"].every((key) => set[key] === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(set[key])))
      || (typeof set.starred !== "boolean" && !(value.version === 0 && set.starred === undefined))
      || (set.starred === true && (!String(set.artist).trim() || !String(set.stage).trim() || !set.start || !set.end || set.start === set.end))) {
      throw new Error("Festival plan contains unsupported sets.");
    }
    return { id: String(set.id), artist: String(set.artist), stage: String(set.stage), day: String(set.day),
      start: String(set.start), end: String(set.end), starred: set.starred === true };
  });
  if (new Set(sets.map((set) => set.id)).size !== sets.length) throw new Error("Festival plan contains duplicate sets.");
  return { version: 1, eventId, event: { ...value.event, id: eventId, title: value.event.title }, updatedAt: value.updatedAt, stages: value.stages, days, sets };
}

function enqueue(eventId: string, operation: () => Promise<void>): Promise<void> {
  const write = (queues.get(eventId) ?? Promise.resolve()).then(operation);
  const settled = write.then(() => undefined, () => undefined);
  queues.set(eventId, settled);
  void settled.then(() => { if (queues.get(eventId) === settled) queues.delete(eventId); });
  return write;
}

export const festivalPlannerStorage = {
  async list(): Promise<FestivalPlan[]> {
    const keys = await AsyncStorage.getAllKeys();
    const plans = await Promise.all(keys.filter((key) => key.startsWith(prefix)).map((key) => this.get(key.slice(prefix.length))));
    return plans.filter((plan): plan is FestivalPlan => plan !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(eventId: string): Promise<FestivalPlan | null> {
    await queues.get(eventId);
    const stored = await AsyncStorage.getItem(prefix + eventId);
    if (stored === null) return null;
    let value: unknown;
    try { value = JSON.parse(stored); } catch { throw new Error("Festival plan could not be read."); }
    return parsePlan(value, eventId);
  },
  async set(plan: FestivalPlan): Promise<void> {
    const validated = parsePlan(plan, plan.eventId);
    return enqueue(plan.eventId, () => AsyncStorage.setItem(prefix + plan.eventId, JSON.stringify(validated)));
  },
  async remove(eventId: string): Promise<void> {
    return enqueue(eventId, () => AsyncStorage.removeItem(prefix + eventId));
  },
};
