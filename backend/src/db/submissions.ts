import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import type { EventSubmission, EventSubmissionInput, RaveOrbCategory, SubmissionStatus } from "../types/index.js";

export type { SubmissionStatus } from "../types/index.js";
export type SubmissionInput = EventSubmissionInput;
export type Submission = EventSubmission;

export interface SubmissionStore {
  create(input: SubmissionInput): Submission;
  get(id: string): Submission | null;
  list(status?: SubmissionStatus): Submission[];
  approve(id: string): Submission | null;
  reject(id: string, reason?: string): Submission | null;
  remove(id: string): boolean;
}

type SubmissionRow = {
  id: string;
  status: SubmissionStatus;
  created_at: string;
  reviewed_at: string | null;
  reject_reason: string | null;
  submitter_email: string | null;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  venue_name: string;
  address: string;
  city: string;
  region: string;
  country_code: string;
  latitude: number;
  longitude: number;
  artists: string;
  style: RaveOrbCategory;
  description: string;
  ticket_url: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  age_restriction: string | null;
};

const defaultDatabasePath = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/raveorb.db");
const schemaVersion = 1;

export function createSubmissionStore(databasePath = process.env.DATABASE_PATH || defaultDatabasePath): SubmissionStore {
  if (databasePath !== ":memory:") mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);

  const mapRow = (row: SubmissionRow | undefined): Submission | null => {
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
      ...(row.reject_reason ? { rejectReason: row.reject_reason } : {}),
      ...(row.submitter_email ? { submitterEmail: row.submitter_email } : {}),
      title: row.title,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      venueName: row.venue_name,
      address: row.address,
      city: row.city,
      region: row.region,
      countryCode: row.country_code,
      latitude: row.latitude,
      longitude: row.longitude,
      artists: JSON.parse(row.artists) as string[],
      style: row.style,
      description: row.description,
      ...(row.ticket_url ? { ticketUrl: row.ticket_url } : {}),
      ...(row.price_min !== null ? { priceMin: row.price_min } : {}),
      ...(row.price_max !== null ? { priceMax: row.price_max } : {}),
      ...(row.currency ? { currency: row.currency } : {}),
      ...(row.age_restriction ? { ageRestriction: row.age_restriction } : {}),
    };
  };
  const byId = db.prepare("SELECT * FROM submissions WHERE id = ?");

  return {
    create(input) {
      const id = randomUUID();
      db.prepare(`INSERT INTO submissions (
        id, status, created_at, submitter_email, title, date, start_time, end_time,
        timezone, venue_name, address, city, region, country_code, latitude, longitude,
        artists, style, description, ticket_url, price_min, price_max, currency, age_restriction
      ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, new Date().toISOString(), input.submitterEmail ?? null, input.title, input.date,
        input.startTime, input.endTime, input.timezone, input.venueName, input.address,
        input.city, input.region ?? "", input.countryCode, input.latitude, input.longitude,
        JSON.stringify(input.artists), input.style, input.description, input.ticketUrl ?? null,
        input.priceMin ?? null, input.priceMax ?? null, input.currency ?? null, input.ageRestriction ?? null,
      );
      return mapRow(byId.get(id) as SubmissionRow | undefined)!;
    },
    get(id) {
      return mapRow(byId.get(id) as SubmissionRow | undefined);
    },
    list(status) {
      const rows = status
        ? db.prepare("SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC").all(status)
        : db.prepare("SELECT * FROM submissions ORDER BY created_at DESC").all();
      return rows.map((row) => mapRow(row as SubmissionRow)!).filter(Boolean);
    },
    approve(id) {
      db.prepare("UPDATE submissions SET status = 'approved', reviewed_at = ?, reject_reason = NULL WHERE id = ?")
        .run(new Date().toISOString(), id);
      return mapRow(byId.get(id) as SubmissionRow | undefined);
    },
    reject(id, reason) {
      db.prepare("UPDATE submissions SET status = 'rejected', reviewed_at = ?, reject_reason = ? WHERE id = ?")
        .run(new Date().toISOString(), reason ?? null, id);
      return mapRow(byId.get(id) as SubmissionRow | undefined);
    },
    remove(id) {
      return db.prepare("DELETE FROM submissions WHERE id = ?").run(id).changes > 0;
    },
  };
}

function migrate(db: DatabaseSync): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL)");
  const version = db.prepare("SELECT version FROM schema_meta LIMIT 1").get() as { version: number } | undefined;
  if (!version) {
    db.exec(`CREATE TABLE submissions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reject_reason TEXT,
      submitter_email TEXT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      timezone TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      country_code TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      artists TEXT NOT NULL,
      style TEXT NOT NULL,
      description TEXT NOT NULL,
      ticket_url TEXT,
      price_min REAL,
      price_max REAL,
      currency TEXT,
      age_restriction TEXT
    )`);
    db.exec("CREATE INDEX submissions_status_date_idx ON submissions(status, date)");
    db.prepare("INSERT INTO schema_meta (version) VALUES (?)").run(schemaVersion);
  } else if (version.version !== schemaVersion) {
    throw new Error(`Unsupported submissions schema version: ${version.version}`);
  }
}

let defaultStore: SubmissionStore | undefined;
export function getDefaultSubmissionStore(): SubmissionStore {
  defaultStore ??= createSubmissionStore();
  return defaultStore;
}
