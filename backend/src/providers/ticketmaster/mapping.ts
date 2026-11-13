import type { EventEntry, EventType, TicketmasterClassification } from "../../types/index.js";

type TicketmasterDate = {
  localDate?: string;
  localTime?: string;
  dateTime?: string;
};

type TicketmasterImage = {
  url?: string;
  width?: number;
  ratio?: string;
};

type TicketmasterAttraction = { name?: string };

type TicketmasterVenue = {
  id?: string;
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { name?: string; stateCode?: string };
  country?: { name?: string; countryCode?: string };
  location?: { latitude?: string; longitude?: string };
  postalCode?: string;
  timezone?: string;
};

type TicketmasterEvent = {
  id?: string;
  name?: string;
  description?: string;
  info?: string;
  pleaseNote?: string;
  url?: string;
  dates?: {
    start?: TicketmasterDate;
    timezone?: string;
    status?: { code?: string };
  };
  sales?: { public?: { startDateTime?: string; endDateTime?: string } };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  images?: TicketmasterImage[];
  classifications?: TicketmasterClassification[];
  _embedded?: {
    venues?: TicketmasterVenue[];
    attractions?: TicketmasterAttraction[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime())
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

function typeFromClassification(classifications: TicketmasterClassification[], name: string): EventType {
  const labels = classifications.flatMap((item) => [item.type?.name, item.subType?.name, item.segment?.name])
    .filter((item): item is string => Boolean(item)).join(" ").toLowerCase();
  const combined = `${labels} ${name}`.toLowerCase();
  if (combined.includes("festival")) return "festival";
  if (combined.includes("rave")) return "rave";
  if (combined.includes("club") || combined.includes("nightclub")) return "club";
  return "concert";
}

function statusFromTicketmaster(code: string | undefined): EventEntry["status"] {
  switch (code?.toLowerCase()) {
    case "cancelled": return "cancelled";
    case "postponed":
    case "rescheduled": return "postponed";
    case "onsale": return "scheduled";
    default: return undefined;
  }
}

export function mapTicketmasterEvent(value: unknown): EventEntry | null {
  if (!isRecord(value)) return null;
  const event = value as TicketmasterEvent;
  const id = string(event.id);
  const title = string(event.name);
  if (!id || !title) return null;

  const dates = record(event.dates);
  const start = record(dates.start);
  const dateTime = string(start.dateTime);
  const date = string(start.localDate) ?? dateTime?.slice(0, 10);
  if (!date || !validDate(date)) return null;
  const localTime = string(start.localTime) ?? (dateTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateTime) ? dateTime.slice(11, 16) : "00:00");

  const embedded = record(event._embedded);
  const venue = record(array(embedded.venues)[0]);
  const venueCity = record(venue.city);
  const venueState = record(venue.state);
  const venueCountry = record(venue.country);
  const venueLocation = record(venue.location);
  const classifications = array(event.classifications).filter(isRecord) as TicketmasterClassification[];
  const artists = array(embedded.attractions).flatMap((attraction) => {
    const attractionName = string(record(attraction).name);
    return attractionName ? [attractionName] : [];
  });
  const genreMap = new Map<string, string>();
  for (const classification of classifications) {
    for (const name of [classification.genre?.name, classification.subGenre?.name]) {
      const cleanName = string(name);
      if (cleanName) genreMap.set(cleanName.toLowerCase(), cleanName);
    }
  }
  const images = array(event.images).filter(isRecord) as TicketmasterImage[];
  const image = [...images].sort((first, second) => {
    const ratioDifference = Number(second.ratio === "16_9") - Number(first.ratio === "16_9");
    return ratioDifference || (number(second.width) ?? 0) - (number(first.width) ?? 0);
  }).find((item) => string(item.url));
  const ranges = array(event.priceRanges).filter(isRecord);
  const currency = ranges.map((item) => string(record(item).currency)).find(Boolean);
  const sameCurrencyRanges = ranges.filter((item) => string(record(item).currency) === currency);
  const minimums = sameCurrencyRanges.map((item) => number(record(item).min)).filter((item): item is number => item !== undefined);
  const maximums = sameCurrencyRanges.map((item) => number(record(item).max)).filter((item): item is number => item !== undefined);
  const ticketSales = record(event.sales);
  const publicSales = record(ticketSales.public);
  const province = string(venueState.name) ?? string(venueState.stateCode);
  const country = string(venueCountry.name);
  const countryCode = string(venueCountry.countryCode) ?? "";
  const latitude = number(venueLocation.latitude);
  const longitude = number(venueLocation.longitude);
  const primaryClassification = classifications[0];
  const segment = string(primaryClassification?.segment?.name);
  const genre = string(primaryClassification?.genre?.name);
  const subgenre = string(primaryClassification?.subGenre?.name);


  return {
    id,
    title,
    type: typeFromClassification(classifications, title),
    venueId: string(venue.id) ?? `ticketmaster-venue-${id}`,
    venueName: string(venue.name) ?? "Venue to be announced",
    city: string(venueCity.name) ?? "",
    countryCode,
    ...(segment ? { segment } : {}),
    ...(genre ? { genre } : {}),
    ...(subgenre ? { subgenre } : {}),
    classifications,
    ...(province ? { province } : {}),
    ...(country ? { country } : {}),
    ...(string(record(venue.address).line1) ? { address: string(record(venue.address).line1) } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    date,
    startTime: localTime,
    endTime: "",
    ...(dateTime ? { dateTime } : {}),
    timezone: string(dates.timezone) ?? string(venue.timezone) ?? "",
    artists,
    genres: [...genreMap.values()],
    description: string(event.description) ?? string(event.info) ?? string(event.pleaseNote) ?? "",
    ...(string(image?.url) ? { imageUrl: string(image?.url) } : {}),
    ...(string(event.url) ? { ticketUrl: string(event.url), eventUrl: string(event.url) } : {}),
    ...(minimums.length ? { priceMin: Math.min(...minimums) } : {}),
    ...(maximums.length ? { priceMax: Math.max(...maximums) } : {}),
    ...(currency ? { currency } : {}),
    source: "ticketmaster",
    sourceEventId: id,
    ...(string(publicSales.startDateTime) ? { ticketSaleStartDateTime: string(publicSales.startDateTime) } : {}),
    ...(string(publicSales.endDateTime) ? { ticketSaleEndDateTime: string(publicSales.endDateTime) } : {}),
    ...(statusFromTicketmaster(string(record(dates.status).code)) ? { status: statusFromTicketmaster(string(record(dates.status).code)) } : {}),
  };
}

