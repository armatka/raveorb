import type { EventEntry } from "../types/event";
import type { Night } from "../types/Night";
import { nightsInOrbitYear } from "../lib/orbit";
import { loadLinkedEvents } from "./linkedEvents";

export async function loadOrbitEvents(nights: Night[], year: string): Promise<{ events: EventEntry[]; failed: number; limited: boolean }> {
  const ids = [...new Set(nightsInOrbitYear(nights, year)
    .flatMap((night) => night.sourceEventId ? [night.sourceEventId] : []))].sort();
  const result = await loadLinkedEvents(ids.slice(0, 50));
  return {
    ...result,
    limited: ids.length > 50,
  };
}
