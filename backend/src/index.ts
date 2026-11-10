import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";

import { events, venues } from "./data/mockData.js";
import { getStats } from "./services/stats.js";
import { EventEntry } from "./types/index.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res: Response) => {
  res.json({ status: "ok", service: "raveorb-backend" });
});

app.get("/api/events", (_req, res: Response) => {
  res.json(events);
});

app.get("/api/venues", (_req, res: Response) => {
  res.json(venues);
});

app.get("/api/stats", (_req, res: Response) => {
  res.json(getStats(events));
});

app.post("/api/events", (req: Request, res: Response) => {
  const body = req.body as Partial<EventEntry>;

  if (
    !body.title
    || !body.type
    || !body.venueId
    || !body.venueName
    || !body.city
    || !body.countryCode
    || !body.date
    || !body.startTime
    || !body.endTime
    || !body.timezone
    || !body.source
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const nextEvent: EventEntry = {
    id: `evt-${Date.now()}`,
    title: body.title,
    type: body.type,
    venueId: body.venueId,
    venueName: body.venueName,
    city: body.city,
    countryCode: body.countryCode,
    address: body.address,
    latitude: body.latitude,
    longitude: body.longitude,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    timezone: body.timezone,
    artists: body.artists ?? [],
    genres: body.genres ?? [],
    description: body.description ?? "",
    imageUrl: body.imageUrl,
    ticketUrl: body.ticketUrl,
    eventUrl: body.eventUrl,
    priceMin: body.priceMin,
    priceMax: body.priceMax,
    currency: body.currency,
    source: body.source,
    sourceEventId: body.sourceEventId,
    ageRestriction: body.ageRestriction,
    status: body.status,
  };

  events.push(nextEvent);
  return res.status(201).json(nextEvent);
});

app.listen(port, () => {
  console.log(`RaveOrb backend listening on http://localhost:${port}`);
});
