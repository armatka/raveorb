import cors from "cors";
import express, { type ErrorRequestHandler, type Response } from "express";

import { events, venues } from "./data/mockData.js";
import { getStats } from "./services/stats.js";
import { GeocodingError, GeocodingQueryError, searchCities } from "./services/geocoding.js";
import { getEventById, parseEventSearchQuery, searchEvents, ProviderError, EventQueryError } from "./services/events.js";

export function createApp(eventService = { searchEvents, getEventById, parseEventSearchQuery }) {
  const app = express();

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
