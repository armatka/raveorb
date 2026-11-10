import AsyncStorage from "@react-native-async-storage/async-storage";

export type EventStatus = "interested" | "going" | "attended";

type EventStatusMap = Record<string, EventStatus>;

const STORAGE_KEY = "raveorb.event-statuses.v1";
let writeQueue: Promise<void> = Promise.resolve();

function isEventStatus(value: unknown): value is EventStatus {
  return value === "interested" || value === "going" || value === "attended";
}

async function readAll(): Promise<EventStatusMap> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, EventStatus] => isEventStatus(entry[1])),
    );
  } catch {
    return {};
  }
}

function updateAll(update: (statuses: EventStatusMap) => EventStatusMap): Promise<void> {
  const write = writeQueue.then(async () => {
    const statuses = await readAll();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(update(statuses)));
  });
  writeQueue = write.catch(() => undefined);
  return write;
}

export const eventStatusStorage = {
  async list(): Promise<EventStatusMap> {
    return readAll();
  },

  async get(eventId: string): Promise<EventStatus | null> {
    const statuses = await readAll();
    return statuses[eventId] ?? null;
  },

  async set(eventId: string, status: EventStatus | null): Promise<void> {
    await updateAll((statuses) => {
      if (status === null) {
        const { [eventId]: _removed, ...remaining } = statuses;
        return remaining;
      }
      return { ...statuses, [eventId]: status };
    });
  },

  async remove(eventId: string): Promise<void> {
    await updateAll((statuses) => {
      const { [eventId]: _removed, ...remaining } = statuses;
      return remaining;
    });
  },
};
