import type { EventEntry } from "../types/event";
import { formatCurrency } from "./formatCurrency";

export function formatEventDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;

  const [, year, month, day] = match;
  const dateValue = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  if (Number.isNaN(dateValue.getTime())) return date;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateValue);
}

export function formatEventSchedule(event: Pick<EventEntry, "date" | "startTime" | "endTime" | "timezone">): string {
  const time = event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
  return `${formatEventDate(event.date)} · ${time}${event.timezone ? ` ${event.timezone}` : ""}`;
}

export function formatEventPrice(event: Pick<EventEntry, "priceMin" | "priceMax" | "currency">): string {
  const { priceMin, priceMax, currency } = event;
  if (priceMin === undefined && priceMax === undefined) return "TBA";
  if (!currency) return "Currency unavailable";
  if (priceMin === 0 && (priceMax === 0 || priceMax === undefined)) return "Free";

  if (priceMin === undefined && priceMax !== undefined) {
    return `Up to ${formatCurrency(priceMax, currency)}`;
  }
  if (priceMin !== undefined && priceMax === undefined) {
    return `From ${formatCurrency(priceMin, currency)}`;
  }
  if (priceMin === undefined || priceMax === undefined) return "TBA";
  if (priceMin === 0) return `Free–${formatCurrency(priceMax, currency)}`;
  if (priceMin === priceMax) return formatCurrency(priceMin, currency);

  return `${formatCurrency(priceMin, currency)}–${formatCurrency(priceMax, currency)}`;
}
