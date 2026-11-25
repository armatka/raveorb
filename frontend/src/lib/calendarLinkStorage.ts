import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "raveorb.calendar-links.v1";
type LinkMap = Record<string, string>;
let writeQueue: Promise<void> = Promise.resolve();

async function readAll(): Promise<LinkMap> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(stored); } catch { throw new Error("Calendar links could not be read."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
    || !Object.values(parsed).every((value) => typeof value === "string" && value.length > 0)) {
    throw new Error("Calendar links contain unsupported records.");
  }
  return parsed as LinkMap;
}

function updateAll<T>(update: (links: LinkMap) => { links: LinkMap; result: T }): Promise<T> {
  const write = writeQueue.then(async () => {
    const current = await readAll();
    const { links, result } = update(current);
    if (links !== current) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    return result;
  });
  writeQueue = write.then(() => undefined, () => undefined);
  return write;
}

/** Maps RaveOrb event ids to the device calendar event ids created for them. */
export const calendarLinkStorage = {
  async list(): Promise<LinkMap> {
    return readAll();
  },
  async get(eventId: string): Promise<string | null> {
    return (await readAll())[eventId] ?? null;
  },
  async set(eventId: string, calendarEventId: string): Promise<void> {
    await updateAll((links) => ({ links: { ...links, [eventId]: calendarEventId }, result: undefined }));
  },
  async remove(eventId: string): Promise<void> {
    await updateAll((links) => {
      if (!(eventId in links)) return { links, result: undefined };
      const { [eventId]: _removed, ...rest } = links;
      return { links: rest, result: undefined };
    });
  },
};
