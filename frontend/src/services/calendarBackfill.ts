import { eventStatusStorage } from "../lib/eventStatusStorage";
import { SAMPLE_EVENT_ID_PREFIX } from "../lib/sampleEvent";
import { SAMPLE_FESTIVAL_ID } from "../lib/sampleFestival";
import { eventsRepository } from "./eventsRepository";

type BackfillResult = { candidates: string[]; attempted: string[]; failed: string[]; pending: number; offline: boolean };
let inFlight: Promise<BackfillResult> | undefined;
let cursor = 0;

export function backfillCalendarEvents(): Promise<BackfillResult> {
  if (inFlight) return inFlight;
  const run = async (): Promise<BackfillResult> => {
    const entries = await eventStatusStorage.listTracked();
    const ids = Object.entries(entries)
      .filter(([id, entry]) => id !== SAMPLE_FESTIVAL_ID && !id.startsWith(SAMPLE_EVENT_ID_PREFIX)
        && (!entry.snapshot || !entry.snapshot.sourceEventId))
      .map(([id]) => id).sort();
    if (!ids.length) return { candidates: [], attempted: [], failed: [], pending: 0, offline: false };
    const start = cursor % ids.length;
    const batch = [...ids.slice(start), ...ids.slice(0, start)].slice(0, 50);
    const attempted: string[] = [];
    const failed: string[] = [];
    let offline = false;
    for (let index = 0; index < batch.length; index += 3) {
      const group = batch.slice(index, index + 3);
      attempted.push(...group);
      const results = await Promise.allSettled(group.map(async (id) => {
        const event = await eventsRepository.getEvent(id);
        if (!event) throw new Error("Saved event not found.");
        if (event.id !== id) throw new Error("Saved event ID does not match.");
        await eventStatusStorage.backfillSnapshots([event]);
        await eventStatusStorage.recordLatest(id, event);
      }));
      results.forEach((result, offset) => {
        if (result.status === "rejected") {
          failed.push(group[offset]);
          if (result.reason instanceof Error && (result.reason.message.startsWith("The event service could not be reached.")
            || result.reason.message.startsWith("The event service timed out."))) offline = true;
        }
      });
      if (offline) break;
    }
    cursor = (start + attempted.length) % ids.length;
    return { candidates: ids, attempted, failed, pending: ids.length - attempted.length, offline };
  };
  const promise = (async () => {
    try { return await run(); } finally { inFlight = undefined; }
  })();
  inFlight = promise;
  return promise;
}
