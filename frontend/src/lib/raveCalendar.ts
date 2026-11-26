import { formatCalendarDate, parseCalendarDate } from "./calendarDate";
import type { EventSnapshot } from "./eventChanges";
import type { EventStatus, TrackedEvent } from "./eventStatusStorage";
import type { Night } from "../types/Night";

export type CalendarFilter = "all" | EventStatus;
export type CalendarItem = {
  key: string;
  kind: EventStatus;
  date: string;
  title: string;
  venue: string;
  time?: string;
  eventId?: string;
  nightId?: string;
  snapshot?: EventSnapshot;
  canLogNight?: boolean;
  timezoneError?: boolean;
};

export function calendarItems(entries: Record<string, TrackedEvent>, nights: Night[], now = new Date()): CalendarItem[] {
  const linked = new Set(nights.flatMap((night) => night.sourceEventId ? [night.sourceEventId] : []));
  const items: CalendarItem[] = nights.map((night) => ({
    key: `night:${night.id}`, kind: "attended", date: night.date, title: night.eventName,
    venue: night.venueName, nightId: night.id,
  }));
  for (const [id, entry] of Object.entries(entries)) {
    const snapshot = entry.latest ?? entry.snapshot;
    if (!snapshot) continue;
    const isLinked = linked.has(id) || Boolean(snapshot.sourceEventId && linked.has(snapshot.sourceEventId))
      || Boolean(entry.snapshot?.sourceEventId && linked.has(entry.snapshot.sourceEventId));
    if (entry.status === "attended" && isLinked) continue;
    let past = false;
    let timezoneError = false;
    if (entry.status === "going" && !isLinked) {
      try {
        if (!snapshot.timezone.trim() || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(snapshot.startTime)) {
          throw new Error("Missing event time or time zone.");
        }
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: snapshot.timezone,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
        }).formatToParts(now);
        const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
        const currentDate = `${values.year}-${values.month}-${values.day}`;
        const currentTime = `${values.hour}:${values.minute}:${values.second}`;
        const eventTime = snapshot.startTime.length === 5 ? `${snapshot.startTime}:00` : snapshot.startTime;
        past = snapshot.date < currentDate || (snapshot.date === currentDate && eventTime < currentTime);
      } catch {
        timezoneError = true;
      }
    }
    items.push({
      key: `event:${id}`, kind: entry.status, date: snapshot.date, title: snapshot.title,
      venue: snapshot.venueName, time: snapshot.startTime, eventId: id, snapshot,
      canLogNight: entry.status === "going" && !isLinked && past, timezoneError,
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
}

export function filterCalendarItems(items: CalendarItem[], filter: CalendarFilter): CalendarItem[] {
  return filter === "all" ? items : items.filter((item) => item.kind === filter);
}

export function weekStartsOn(firstWeekday: number | null, locale: string): number {
  if (firstWeekday !== null && firstWeekday >= 1 && firstWeekday <= 7) return firstWeekday - 1;
  let region: string | undefined;
  if (typeof Intl.Locale === "function") {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const first = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    if (first) return first % 7;
    region = info.maximize().region;
  } else {
    region = locale.split("-").find((part) => /^[A-Z]{2}$/.test(part));
  }
  if (region === "MV") return 5;
  if (region && "AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" ").includes(region)) return 6;
  if (region && "AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN IS JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(" ").includes(region)) return 0;
  return 1;
}

export function monthGrid(year: number, month: number, firstWeekday: number): (string | null)[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() - firstWeekday + 7) % 7;
  const days = new Date(year, month + 1, 0, 12).getDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= days; day++) cells.push(formatCalendarDate(new Date(year, month, day, 12)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function shiftMonth(date: string, delta: number): string {
  const parsed = parseCalendarDate(date);
  if (!parsed) throw new Error("Invalid calendar date.");
  return formatCalendarDate(new Date(parsed.getFullYear(), parsed.getMonth() + delta, 1, 12));
}
