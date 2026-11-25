import { detectEventChanges, isEventUpcoming, type EventChange } from "../lib/eventChanges";
import { eventStatusStorage, type TrackedEvent } from "../lib/eventStatusStorage";
import { eventsRepository } from "./eventsRepository";

export type TrackedEventChanges = { id: string; entry: TrackedEvent; changes: EventChange[] };
let inFlight: Promise<void> | undefined;

export async function refreshTrackedEvents(): Promise<void> {
  if (inFlight) return inFlight;
  const refresh = (async () => {
    const ids = await eventStatusStorage.reserveRefresh();
    const results = await Promise.allSettled(ids.map(async (id) => {
      const event = await eventsRepository.getEvent(id);
      if (!event) throw new Error("A saved event is no longer available.");
      await eventStatusStorage.recordLatest(id, event);
    }));
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("Some saved events could not be refreshed. Try again later.");
    }
  })();
  inFlight = refresh;
  try { await refresh; } finally { if (inFlight === refresh) inFlight = undefined; }
}

export async function listTrackedEventChanges(now = new Date()): Promise<TrackedEventChanges[]> {
  const entries = await eventStatusStorage.listTracked();
  return Object.entries(entries).flatMap(([id, entry]) => {
    if ((entry.status !== "going" && entry.status !== "interested") || !entry.snapshot
      || !isEventUpcoming(entry.snapshot, now) || (entry.latest && !isEventUpcoming(entry.latest, now))) return [];
    return [{ id, entry, changes: entry.latest ? detectEventChanges(entry.snapshot, entry.latest) : [] }];
  });
}
