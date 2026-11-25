import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "raveorb.not-interested.v1";
let queue: Promise<void> = Promise.resolve();

async function read(): Promise<string[]> {
  const stored = await AsyncStorage.getItem(KEY);
  if (stored === null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(stored); } catch { throw new Error("Not interested events could not be read."); }
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string" && id.length > 0)) {
    throw new Error("Not interested events contain unsupported records.");
  }
  return parsed;
}

export const notInterestedStorage = {
  async list(): Promise<string[]> {
    await queue;
    return read();
  },
  set(id: string, excluded: boolean): Promise<void> {
    if (!id) return Promise.reject(new Error("Event ID is required."));
    const write = queue.then(async () => {
      const ids = new Set(await read());
      if (excluded) ids.add(id);
      else ids.delete(id);
      await AsyncStorage.setItem(KEY, JSON.stringify([...ids].sort()));
    });
    queue = write.then(() => undefined, () => undefined);
    return write;
  },
};
