import AsyncStorage from "@react-native-async-storage/async-storage";

export type EventStatus = "interested" | "going" | "attended";

type EventStatusMap = Record<string, EventStatus>;

const STORAGE_KEY = "raveorb.event-statuses.v1";

async function readAll(): Promise<EventStatusMap> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as EventStatusMap;
  } catch {
    return {};
  }
}

async function writeAll(statuses: EventStatusMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
}

export const eventStatusStorage = {
  async get(eventId: string): Promise<EventStatus | null> {
    const statuses = await readAll();
    return statuses[eventId] ?? null;
  },

  async set(eventId: string, status: EventStatus): Promise<void> {
    const statuses = await readAll();
    await writeAll({
      ...statuses,
      [eventId]: status,
    });
  },

  async remove(eventId: string): Promise<void> {
    const statuses = await readAll();
    delete statuses[eventId];
    await writeAll(statuses);
  },
};
