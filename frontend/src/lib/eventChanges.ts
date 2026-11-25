import type { EventEntry, EventStatus } from "../types/event";

export type EventSnapshot = {
  title: string;
  status?: EventStatus;
  date: string;
  startTime: string;
  venueName: string;
  city: string;
  timezone: string;
};

export type EventChangeKind = "cancelled" | "postponed" | "rescheduled" | "venue" | "sold-out" | "tickets-available";
export type EventChange = { kind: EventChangeKind; label: string };

export function snapshotEvent(event: EventEntry): EventSnapshot {
  return {
    title: event.title, status: event.status, date: event.date, startTime: event.startTime,
    venueName: event.venueName, city: event.city, timezone: event.timezone,
  };
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function time(value: string): string {
  return value.trim().replace(/^(\d{2}:\d{2}):00$/, "$1");
}

function schedule(value: EventSnapshot): string {
  const date = new Date(`${value.date}T12:00:00Z`);
  const day = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(date)
    : "";
  return `${day ? `${day} ` : ""}${value.date} ${time(value.startTime)}`;
}

export function detectEventChanges(snapshot: EventSnapshot, latest: EventSnapshot): EventChange[] {
  const changes: EventChange[] = [];
  const changedStatus = snapshot.status !== latest.status;
  if (changedStatus && latest.status === "cancelled") changes.push({ kind: "cancelled", label: "Cancelled" });
  if (changedStatus && latest.status === "postponed") changes.push({ kind: "postponed", label: "Postponed" });
  const scheduleChanged = snapshot.date !== latest.date || time(snapshot.startTime) !== time(latest.startTime);
  if (scheduleChanged || (changedStatus && latest.status === "rescheduled")) {
    changes.push({
      kind: "rescheduled",
      label: scheduleChanged
        ? `Moved from ${schedule(snapshot)} to ${schedule(latest)}`
        : "Rescheduled",
    });
  }
  if (normalized(snapshot.venueName) !== normalized(latest.venueName) || normalized(snapshot.city) !== normalized(latest.city)) {
    changes.push({ kind: "venue", label: `Venue changed from ${snapshot.venueName} to ${latest.venueName}` });
  }
  if (changedStatus && latest.status === "sold-out") changes.push({ kind: "sold-out", label: "Sold out" });
  if (changedStatus && snapshot.status === "sold-out" && latest.status === "scheduled") {
    changes.push({ kind: "tickets-available", label: "Tickets available again" });
  }
  return changes;
}

export function isEventUpcoming(snapshot: EventSnapshot, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    ...(snapshot.timezone ? { timeZone: snapshot.timezone } : {}),
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return snapshot.date >= `${values.year}-${values.month}-${values.day}`;
}

export function acknowledgeChange(snapshot: EventSnapshot, latest: EventSnapshot, kind: EventChangeKind): EventSnapshot {
  if (kind === "venue") return { ...snapshot, venueName: latest.venueName, city: latest.city };
  if (kind === "rescheduled") return {
    ...snapshot, date: latest.date, startTime: latest.startTime, timezone: latest.timezone,
    ...(latest.status === "rescheduled" ? { status: latest.status } : {}),
  };
  return { ...snapshot, status: latest.status };
}
