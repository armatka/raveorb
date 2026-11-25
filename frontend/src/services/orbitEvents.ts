import type { EventEntry } from "../types/event";
import type { Night } from "../types/Night";
import { nightsInOrbitYear } from "../lib/orbit";
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

export async function loadOrbitEvents(nights: Night[], year: string): Promise<{ events: EventEntry[]; failed: number; limited: boolean }> {
  const ids = [...new Set(nightsInOrbitYear(nights, year)
    .flatMap((night) => night.sourceEventId ? [night.sourceEventId] : []))].sort();
  const results = await Promise.allSettled(ids.slice(0, 50).map(getEvent));
  return {
    events: results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []),
    failed: results.filter((result) => result.status === "rejected").length,
    limited: ids.length > 50,
  };
}
