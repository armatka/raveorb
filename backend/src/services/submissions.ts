import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { raveOrbCategories, type RaveOrbCategory } from "../types/index.js";
import type { SubmissionInput } from "../db/submissions.js";

const limits = {
  title: 150,
  venueName: 120,
  address: 200,
  city: 120,
  region: 80,
  timezone: 60,
  artist: 80,
  description: 2000,
  ticketUrl: 500,
  currency: 3,
  ageRestriction: 40,
  submitterEmail: 254,
} as const;

export class SubmissionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubmissionValidationError";
  }
}

function text(value: unknown, key: string, maximum: number, required = true): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") throw new SubmissionValidationError(`${key} must be text.`);
  const clean = value.trim();
  if (required && !clean) throw new SubmissionValidationError(`${key} is required.`);
  if (clean.length > maximum) throw new SubmissionValidationError(`${key} must be ${maximum} characters or fewer.`);
  return clean || undefined;
}

function numberValue(value: unknown, key: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new SubmissionValidationError(`${key} must be between ${min} and ${max}.`);
  }
  return value;
}

function optionalPrice(value: unknown, key: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000) {
    throw new SubmissionValidationError(`${key} must be between 0 and 100000.`);
  }
  return value;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

function dateInTimeZone(timeZone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function validateSubmissionInput(value: unknown): SubmissionInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SubmissionValidationError("Submission body must be an object.");
  }
  const input = value as Record<string, unknown>;
  const title = text(input.title, "title", limits.title)!;
  const date = text(input.date, "date", 10)!;
  if (!validDate(date)) throw new SubmissionValidationError("date must be a valid YYYY-MM-DD date.");
  const startTime = text(input.startTime, "startTime", 5)!;
  const endTime = text(input.endTime, "endTime", 5)!;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new SubmissionValidationError("startTime must use HH:MM.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) throw new SubmissionValidationError("endTime must use HH:MM.");
  const timezone = text(input.timezone, "timezone", limits.timezone)!;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new SubmissionValidationError("timezone must be a valid time zone.");
  }
  const today = dateInTimeZone(timezone);
  if (date < today || date > addCalendarMonths(today, 18)) {
    throw new SubmissionValidationError("date must be today or within the next 18 months.");
  }
  const venueName = text(input.venueName, "venueName", limits.venueName)!;
  const address = text(input.address, "address", limits.address)!;
  const city = text(input.city, "city", limits.city)!;
  const region = text(input.region, "region", limits.region, false) ?? "";
  const countryCode = text(input.countryCode, "countryCode", 2)!.toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new SubmissionValidationError("countryCode must be a two-letter code.");
  const latitude = numberValue(input.latitude, "latitude", -90, 90);
  const longitude = numberValue(input.longitude, "longitude", -180, 180);
  if (!Array.isArray(input.artists) || input.artists.length > 20) {
    throw new SubmissionValidationError("artists must be an array of up to 20 names.");
  }
  const artists = input.artists.map((artist, index) => text(artist, `artists[${index}]`, limits.artist)!);
  const style = text(input.style, "style", 40)!;
  if (!raveOrbCategories.includes(style as RaveOrbCategory)) throw new SubmissionValidationError("style is not a supported RaveOrb category.");
  const description = text(input.description, "description", limits.description)!;
  const ticketUrl = text(input.ticketUrl, "ticketUrl", limits.ticketUrl, false);
  if (ticketUrl) {
    try {
      if (new URL(ticketUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new SubmissionValidationError("ticketUrl must be a valid HTTPS URL.");
    }
  }
  const priceMin = optionalPrice(input.priceMin, "priceMin");
  const priceMax = optionalPrice(input.priceMax, "priceMax");
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
    throw new SubmissionValidationError("priceMin must not exceed priceMax.");
  }
  const currency = text(input.currency, "currency", limits.currency, false)?.toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new SubmissionValidationError("currency must be a three-letter code.");
  const ageRestriction = text(input.ageRestriction, "ageRestriction", limits.ageRestriction, false);
  const submitterEmail = text(input.submitterEmail, "submitterEmail", limits.submitterEmail, false);
  if (submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw new SubmissionValidationError("submitterEmail must be a valid email address.");
  }
  return {
    title, date, startTime, endTime, timezone, venueName, address, city, region, countryCode,
    latitude, longitude, artists, style: style as RaveOrbCategory, description,
    ...(ticketUrl ? { ticketUrl } : {}),
    ...(priceMin !== undefined ? { priceMin } : {}),
    ...(priceMax !== undefined ? { priceMax } : {}),
    ...(currency ? { currency } : {}),
    ...(ageRestriction ? { ageRestriction } : {}),
    ...(submitterEmail ? { submitterEmail } : {}),
  };
}

export function createSubmissionRateLimiter(windowMs = 60 * 60 * 1000, maximum = 5) {
  const requestsByIp = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    for (const [ip, timestamps] of requestsByIp) {
      const recentTimestamps = timestamps.filter((timestamp) => now - timestamp < windowMs);
      if (recentTimestamps.length) requestsByIp.set(ip, recentTimestamps);
      else requestsByIp.delete(ip);
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const recent = requestsByIp.get(ip) ?? [];
    if (recent.length >= maximum) {
      requestsByIp.set(ip, recent);
      return res.status(429).json({ error: "Too many submissions. Please try again later." });
    }
    recent.push(now);
    requestsByIp.set(ip, recent);
    return next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    res.status(503).json({ error: "Admin review is not configured." });
    return;
  }
  const authorization = req.get("authorization");
  const supplied = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!supplied) {
    res.status(401).json({ error: "Admin authorization required." });
    return;
  }
  const expectedDigest = createHash("sha256").update(configuredToken).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  if (!timingSafeEqual(expectedDigest, suppliedDigest)) {
    res.status(401).json({ error: "Admin authorization required." });
    return;
  }
  next();
}
