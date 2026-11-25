import type { EventEntry } from "../types/event";
import { eventsRepository } from "./eventsRepository";

const cache = new Map<string, Promise<EventEntry | null>>();
const waiting: (() => void)[] = [];
let active = 0;

async function getEvent(id: string): Promise<EventEntry | null> {
  const existing = cache.get(id);
  if (existing) return existing;
  const promise = (async () => {
    if (active >= 3) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await eventsRepository.getEvent(id);
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  })();
  cache.set(id, promise);
  promise.catch(() => { if (cache.get(id) === promise) cache.delete(id); });
  return promise;
}

export async function loadLinkedEvents(ids: string[]): Promise<{ events: EventEntry[]; failed: number }> {
  const results = await Promise.allSettled([...new Set(ids)].sort().map(getEvent));
  return {
    events: results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []),
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
