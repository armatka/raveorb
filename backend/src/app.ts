import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler, type Response } from "express";

import { getDefaultSubmissionStore, type SubmissionInput, type SubmissionStatus, type SubmissionStore } from "./db/submissions.js";
import { events, venues } from "./data/mockData.js";
import type { EventEntry } from "./types/index.js";
import { getStats } from "./services/stats.js";
import { GeocodingError, GeocodingQueryError, searchCities } from "./services/geocoding.js";
import { getEventById, parseEventSearchQuery, searchEvents, ProviderError, EventQueryError } from "./services/events.js";
import { isLikelySameEvent } from "./services/deduplication.js";
import { ticketmasterProvider as registeredTicketmasterProvider } from "./providers/ticketmaster/index.js";
import type { EventProvider } from "./providers/types.js";
import { createSubmissionRateLimiter, requireAdmin, SubmissionValidationError, validateSubmissionChange, validateSubmissionInput } from "./services/submissions.js";

type EventService = {
  searchEvents: typeof searchEvents;
  getEventById: typeof getEventById;
  parseEventSearchQuery: typeof parseEventSearchQuery;
};

type AppOptions = {
  submissionStore?: SubmissionStore;
  submissionRateLimiter?: RequestHandler;
  ticketmasterProvider?: EventProvider;
};

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function createApp(
  eventService: EventService = { searchEvents, getEventById, parseEventSearchQuery },
  options: AppOptions = {},
) {
  const app = express();
  const getSubmissionStore = () => options.submissionStore ?? getDefaultSubmissionStore();
  const submissionRateLimiter = options.submissionRateLimiter ?? createSubmissionRateLimiter();
  const reviewProvider = options.ticketmasterProvider ?? registeredTicketmasterProvider;

  app.use(cors({ exposedHeaders: ["X-Page", "X-Total-Pages", "X-Total-Elements", "X-Provider-Errors"] }));
  app.use(express.json());

  app.get("/api/health", (_req, res: Response) => {
    res.json({ status: "ok", service: "raveorb-backend" });
  });

  app.get("/api/locations/search", async (req, res: Response) => {
    if (typeof req.query.q !== "string") {
      return res.status(400).json({ error: "Enter a city name between 2 and 80 characters." });
    }
    try {
      return res.json(await searchCities(req.query.q));
    } catch (error) {
      if (error instanceof GeocodingQueryError) return res.status(400).json({ error: error.message });
      if (error instanceof GeocodingError) {
        console.error("City search request failed", { kind: error.kind });
        return res.status(502).json({ error: error.message });
      }
      console.error("City search request failed", { kind: "internal" });
      return res.status(500).json({ error: "City search is temporarily unavailable. Please try again." });
    }
  });

  app.get("/api/events", async (req, res: Response) => {
    try {
      const page = await eventService.searchEvents(eventService.parseEventSearchQuery(req.query));
      res.setHeader("X-Page", String(page.page));
      res.setHeader("X-Total-Pages", String(page.totalPages));
      res.setHeader("X-Total-Elements", String(page.totalElements));
      if (page.providerErrors.length) res.setHeader("X-Provider-Errors", page.providerErrors.join(","));
      return res.json(page.events);
    } catch (error) {
      return sendEventError(error, res);
    }
  });

  app.get("/api/events/:id", async (req, res: Response) => {
    try {
      const event = await eventService.getEventById(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });
      return res.json(event);
    } catch (error) {
      return sendEventError(error, res);
    }
  });

  app.post("/api/submissions", (req, res: Response, next) => {
    try {
      res.locals.submissionInput = validateSubmissionInput(req.body);
      return next();
    } catch (error) {
      if (error instanceof SubmissionValidationError) return res.status(400).json({ error: error.message });
      throw error;
    }
  }, submissionRateLimiter, (req, res: Response) => {
    const submission = getSubmissionStore().create(res.locals.submissionInput as SubmissionInput);
    return res.status(201).json({ id: submission.id, status: "pending" });
  });

  app.use("/api/admin", requireAdmin);

  app.get("/api/admin/submissions", async (req, res: Response) => {
    const rawStatus = req.query.status ?? "pending";
    if (typeof rawStatus !== "string" || !["pending", "approved", "rejected"].includes(rawStatus)) {
      return res.status(400).json({ error: "status must be pending, approved, or rejected." });
    }
    const submissions = getSubmissionStore().list(rawStatus as SubmissionStatus);
    if (rawStatus !== "pending" || !submissions.length) return res.json(submissions);
    try {
      const searches = new Map<string, Promise<EventEntry[]>>();
      for (const submission of submissions) {
        const key = `${submission.date}|${submission.city}|${submission.countryCode}`;
        if (!searches.has(key)) {
          if (!reviewProvider.isConfigured()) {
            searches.set(key, Promise.resolve([]));
          } else {
            const query = eventService.parseEventSearchQuery({
              city: submission.city,
              countryCode: submission.countryCode,
              startDate: shiftDate(submission.date, -1),
              endDate: shiftDate(submission.date, 1),
              page: "0",
              size: "50",
            });
            searches.set(key, reviewProvider.search(query).then((page) => page.events));
          }
        }
      }
      const pages = new Map<string, EventEntry[]>();
      await Promise.all([...searches].map(async ([key, result]) => pages.set(key, await result)));
      const enriched = submissions.map((submission) => {
        const key = `${submission.date}|${submission.city}|${submission.countryCode}`;
        const ticketmasterEvents = pages.get(key)!;
        const candidate: EventEntry = {
          id: `submitted-${submission.id}`,
          source: "submitted",
          title: submission.title,
          type: submission.style === "Festival" ? "festival" : "rave",
          venueId: `submitted-${submission.id}`,
          venueName: submission.venueName,
          city: submission.city,
          countryCode: submission.countryCode,
          province: submission.region,
          latitude: submission.latitude,
          longitude: submission.longitude,
          date: submission.date,
          startTime: submission.startTime,
          endTime: submission.endTime,
          timezone: submission.timezone,
          artists: submission.artists,
          genres: [submission.style],
          description: submission.description,
        };
        const possibleDuplicates = ticketmasterEvents
          .flatMap((event) => {
            const result = isLikelySameEvent(candidate, event);
            return result.match
              ? [{ id: event.id, title: event.title, venueName: event.venueName, score: result.score }]
              : [];
          });
        return { ...submission, possibleDuplicates };
      });
      return res.json(enriched);
    } catch (error) {
      return sendEventError(error, res);
    }
  });

  app.post("/api/admin/submissions/:id/approve", (req, res: Response) => {
    const submission = getSubmissionStore().approve(req.params.id);
    if (!submission) return res.status(404).json({ error: "Submission not found." });
    return res.json(submission);
  });

  app.post("/api/admin/submissions/:id/reject", (req, res: Response) => {
    const reason = req.body?.reason;
    if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
      return res.status(400).json({ error: "reason must be text of 500 characters or fewer." });
    }
    const submission = getSubmissionStore().reject(req.params.id, typeof reason === "string" ? reason.trim() : undefined);
    if (!submission) return res.status(404).json({ error: "Submission not found." });
    return res.json(submission);
  });

  app.patch("/api/admin/submissions/:id/event", (req, res: Response) => {
    const current = getSubmissionStore().get(req.params.id);
    if (!current) return res.status(404).json({ error: "Submission not found." });
    if (current.status !== "approved") return res.status(409).json({ error: "Only approved submissions can be changed." });
    try {
      const submission = getSubmissionStore().updateEvent(req.params.id, validateSubmissionChange(req.body, current));
      if (!submission) return res.status(409).json({ error: "Submission is no longer approved." });
      return res.json(submission);
    } catch (error) {
      if (error instanceof SubmissionValidationError) return res.status(400).json({ error: error.message });
      throw error;
    }
  });

  app.delete("/api/admin/submissions/:id", (req, res: Response) => {
    if (!getSubmissionStore().remove(req.params.id)) return res.status(404).json({ error: "Submission not found." });
    return res.status(204).end();
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
  return app;
}

export const app = createApp();

function sendEventError(error: unknown, res: Response) {
  if (error instanceof EventQueryError) return res.status(400).json({ error: error.message });
  if (error instanceof ProviderError) {
    console.error("Event request failed", { kind: error.kind, statusCode: error.statusCode, upstreamStatus: error.upstreamStatus });
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error("Event request failed", { kind: "internal" });
  return res.status(500).json({ error: "Event search is temporarily unavailable." });
}
