import cors from "cors";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler, type Response } from "express";

import { events, venues } from "./data/mockData.js";
import { getStats } from "./services/stats.js";
import type { EventEntry, EventType } from "./types/index.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res: Response) => {
  res.json({ status: "ok", service: "raveorb-backend" });
});

app.get("/api/events", (_req, res: Response) => {
  const parsed = parseEventFilters(_req.query);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  return res.json(events.filter((event) => matchesEventFilters(event, parsed.filters)));
});

app.get("/api/events/:id", (req, res: Response) => {
  const event = events.find((item) => item.id === req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  return res.json(event);
});

app.get("/api/venues", (_req, res: Response) => {
  res.json(venues);
});

app.get("/api/venues/:id", (req, res: Response) => {
  const venue = venues.find((item) => item.id === req.params.id);
  if (!venue) return res.status(404).json({ error: "Venue not found" });
  return res.json(venue);
});

app.get("/api/stats", (_req, res: Response) => {
  res.json(getStats(events));
});

app.use((_req, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  console.error("Unhandled API error", error);
  res.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`RaveOrb backend listening on http://localhost:${port}`);
});

type EventFilters = {
  city?: string;
  genre?: string;
  type?: EventType;
  startDate?: string;
  endDate?: string;
  search?: string;
};

const allowedEventFilters = new Set(["city", "genre", "type", "startDate", "endDate", "search"]);
const eventTypes = new Set<EventType>(["festival", "rave", "concert", "club"]);

function parseIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseEventFilters(query: Record<string, unknown>): { filters: EventFilters; error?: string } {
  for (const key of Object.keys(query)) {
    if (!allowedEventFilters.has(key)) return { filters: {}, error: `Unsupported query parameter: ${key}` };
  }

  const filters: EventFilters = {};
  for (const key of ["city", "genre", "type", "startDate", "endDate", "search"] as const) {
    const raw = query[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") return { filters: {}, error: `${key} must be a single string value` };
    const value = raw.trim();
    if (!value) continue;
    if (value.length > 120) return { filters: {}, error: `${key} must be 120 characters or fewer` };
    if (key === "type") {
      if (!eventTypes.has(value as EventType)) return { filters: {}, error: "type must be festival, rave, concert, or club" };
      filters.type = value as EventType;
    } else if (key === "startDate" || key === "endDate") {
      if (!parseIsoDate(value)) return { filters: {}, error: `${key} must be a valid YYYY-MM-DD date` };
      filters[key] = value;
    } else {
      filters[key] = value;
    }
  }

  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    return { filters: {}, error: "startDate must be on or before endDate" };
  }

  return { filters };
}

function matchesEventFilters(event: EventEntry, filters: EventFilters): boolean {
  if (filters.city && event.city.toLocaleLowerCase() !== filters.city.toLocaleLowerCase()) return false;
  if (filters.genre && !event.genres.some((genre) => genre.toLocaleLowerCase() === filters.genre?.toLocaleLowerCase())) return false;
  if (filters.type && event.type !== filters.type) return false;
  if (filters.startDate && event.date < filters.startDate) return false;
  if (filters.endDate && event.date > filters.endDate) return false;
  if (filters.search) {
    const search = filters.search.toLocaleLowerCase();
    const searchableText = [event.title, event.venueName, event.city, ...event.artists, ...event.genres]
      .join(" ")
      .toLocaleLowerCase();
    if (!searchableText.includes(search)) return false;
  }
  return true;
}
