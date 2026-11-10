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

  if (!body.title || !body.type || !body.city || !body.date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const nextEvent: EventEntry = {
    id: `evt-${Date.now()}`,
    title: body.title,
    type: body.type,
    venueId: body.venueId ?? "ven-temp",
    city: body.city,
    date: body.date,
    startTime: body.startTime ?? "22:00",
    endTime: body.endTime ?? "03:00",
    artists: body.artists ?? [],
    spend: Number(body.spend ?? 0),
    vibeScore: Number(body.vibeScore ?? 0),
    durationHours: Number(body.durationHours ?? 4),
    notes: body.notes ?? "",
  };

  events.push(nextEvent);
  return res.status(201).json(nextEvent);
});

app.listen(port, () => {
  console.log(`RaveOrb backend listening on http://localhost:${port}`);
});
