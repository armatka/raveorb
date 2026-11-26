import { buildCalendarEventDetails } from "../lib/calendarEventDetails";
import { calendarLinkStorage } from "../lib/calendarLinkStorage";
import { detectEventChanges, isEventUpcoming, type EventChange, type EventChangeKind } from "../lib/eventChanges";
import { eventStatusStorage, type TrackedEvent } from "../lib/eventStatusStorage";
import { calendarService } from "./calendarService";
import { eventsRepository } from "./eventsRepository";

export type TrackedEventChanges = { id: string; entry: TrackedEvent; changes: EventChange[] };
let inFlight: Promise<void> | undefined;

export async function refreshTrackedEvents(skipIds: ReadonlySet<string> = new Set()): Promise<void> {
  if (inFlight) return inFlight;
  const refresh = (async () => {
    const ids = await eventStatusStorage.reserveRefresh(new Date(), skipIds);
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

export function canUpdateCalendar(kind: EventChangeKind): boolean {
  return kind === "rescheduled" || kind === "cancelled";
}

/** Applies a detected change to the calendar event the user created for this RaveOrb event. */
export async function updateCalendarForChange(id: string, kind: EventChangeKind): Promise<void> {
  const linked = await calendarLinkStorage.get(id);
  if (!linked) throw new Error("This event is not in your calendar.");
  if (!(await calendarService.ensurePermission())) {
    throw new Error("To update it, allow Calendar access for RaveOrb in your device Settings.");
  }
  if (!(await calendarService.eventExists(linked))) {
    await calendarLinkStorage.remove(id);
    throw new Error("This event is no longer in your calendar.");
  }
  if (kind === "cancelled") {
    await calendarService.markCancelled(linked);
    return;
  }
  const event = await eventsRepository.getEvent(id);
  if (!event) throw new Error("This event is no longer available.");
  const details = buildCalendarEventDetails(event);
  if (!details) throw new Error("This event's schedule could not be read.");
  await calendarService.rescheduleEvent(linked, details);
}
