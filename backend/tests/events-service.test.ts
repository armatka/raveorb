import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { createApp } from "../src/app.js";
import { createSubmissionStore } from "../src/db/submissions.js";
import { mapTicketmasterEvent } from "../src/providers/ticketmaster/mapping.js";
import { createSubmittedProvider } from "../src/providers/submitted/index.js";
import { ticketmasterProvider } from "../src/providers/ticketmaster/index.js";
import type { EventProvider, ProviderPage } from "../src/providers/types.js";
import type { EventEntry } from "../src/types/index.js";
import { createEventService, EventQueryError, getEventById, parseEventSearchQuery, ProviderError, searchEvents } from "../src/services/events.js";

function event(id: string, title: string, date: string) {
  const mapped = mapTicketmasterEvent({ id, name: title, dates: { start: { localDate: date } } });
  assert.ok(mapped);
  return mapped;
}

function provider(id: string, events: ReturnType<typeof event>[]): EventProvider {
  return {
    id,
    displayName: id === "ticketmaster" ? "Ticketmaster" : id,
    isConfigured: () => true,
    search: async (query): Promise<ProviderPage> => ({ events, page: query.page, totalPages: 4, totalElements: 42 }),
    getById: async () => events[0] ?? null,
  };
}

const query = () => parseEventSearchQuery({ countryCode: "US", sort: "name,asc" });

test("classifies and filters once after search and preserves one provider's order and pagination", async () => {
  const entries = [event("later", "Techno Night", "2030-07-01"), event("earlier", "Rock Night", "2030-01-01")];
  const tm = provider("ticketmaster", entries);
  const result = await searchEvents(query(), [tm]);
  assert.deepEqual(result.events.map((item) => item.id), ["later", "earlier"]);
  assert.equal(result.events[0].isElectronic, true);
  assert.equal(result.events[0].raveOrbCategory, "Techno");
  assert.equal(result.events[1].isElectronic, false);
  assert.deepEqual([result.page, result.totalPages, result.totalElements], [0, 4, 42]);
  assert.equal(entries[0].isElectronic, undefined);
  const filtered = await searchEvents({ ...query(), electronicOnly: true }, [tm]);
  assert.deepEqual(filtered.events.map((item) => item.id), ["later"]);
  const withEmptyProvider = await searchEvents(query(), [tm, provider("empty", [])]);
  assert.deepEqual(withEmptyProvider.events.map((item) => item.id), ["later", "earlier"]);
});

test("merges successful pages by date and reports failures without exposing errors", async () => {
  const a = provider("ticketmaster", [event("late", "Late", "2030-06-02")]);
  const b = provider("other", [event("other-early", "Early", "2030-06-01")]);
  const failed = provider("failed", []);
  failed.search = () => { throw new Error("sensitive provider detail"); };
  const result = await searchEvents(query(), [a, failed, b]);
  assert.deepEqual(result.events.map((item) => item.id), ["other-early", "late"]);
  assert.deepEqual(result.providerErrors, ["failed"]);
  assert.equal(result.totalElements, 84);
  const descending = await searchEvents({ ...query(), sort: "date,desc" }, [a, b]);
  assert.deepEqual(descending.events.map((item) => item.id), ["late", "other-early"]);
  const singleSuccess = await searchEvents(query(), [failed, a]);
  assert.deepEqual(singleSuccess.events.map((item) => item.id), ["late"]);
});

test("deduplicates cross-provider events while preserving lookup by the merged-away ID", async () => {
  const ticketmaster = event("same-show", "Charlotte de Witte", "2030-06-07");
  Object.assign(ticketmaster, {
    venueName: "The Warehouse",
    city: "Montreal",
    countryCode: "CA",
    latitude: 45.5017,
    longitude: -73.5673,
    artists: ["Charlotte de Witte"],
  });
  const submission: EventEntry = {
    ...ticketmaster,
    id: "submitted-community",
    source: "submitted",
    sourceEventId: "community",
    ticketUrl: undefined,
    eventUrl: undefined,
    description: "Community event details",
  };
  const tm = provider("ticketmaster", [ticketmaster]);
  const submitted: EventProvider = {
    ...provider("submitted", [submission]),
    getById: async (id) => id === "community" ? submission : null,
  };
  const service = createEventService([tm, submitted]);
  const result = await service.searchEvents(query());
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, ticketmaster.id);
  assert.deepEqual(result.events[0].alsoListedOn, [{
    source: "submitted",
    id: submission.id,
  }]);
  assert.equal(result.events[0].description, "Community event details");
  const detail = await service.getEventById("submitted-community");
  assert.equal(detail?.id, "submitted-community");
  assert.equal(detail?.description, result.events[0].description);
  assert.deepEqual(detail?.alsoListedOn, [{ source: "ticketmaster", id: ticketmaster.id }]);
});

test("Ticketmaster detail includes approved adjacent-night submissions and fresh moderation changes", async () => {
  const store = createSubmissionStore(":memory:");
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const nextDate = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const tmEvent = {
    ...event("detail-tm", "Warehouse Techno", date),
    city: "Montreal",
    countryCode: "CA",
    venueName: "Warehouse",
    startTime: "23:00",
    timezone: "America/Toronto",
    ticketUrl: "https://ticketmaster.example.test/tickets",
  };
  const input = {
    title: tmEvent.title,
    date: nextDate,
    startTime: "00:30",
    endTime: "04:00",
    timezone: tmEvent.timezone,
    venueName: tmEvent.venueName,
    address: "10 Example Street",
    city: tmEvent.city,
    countryCode: tmEvent.countryCode,
    latitude: 45.5017,
    longitude: -73.5673,
    artists: ["DJ Example"],
    style: "Techno" as const,
    description: "Community details",
    ticketUrl: "https://community.example.test/tickets",
  };
  const approved = store.create(input);
  store.approve(approved.id);
  store.create(input);
  const service = createEventService([
    provider("ticketmaster", [tmEvent]),
    createSubmittedProvider(store),
  ]);
  const detail = await service.getEventById(tmEvent.id);
  assert.equal(detail?.id, tmEvent.id);
  assert.equal(detail?.description, input.description);
  assert.deepEqual(detail?.artists, input.artists);
  assert.deepEqual(detail?.alsoListedOn, [{
    source: "submitted",
    id: `submitted-${approved.id}`,
    eventUrl: input.ticketUrl,
  }]);
  store.reject(approved.id);
  assert.equal((await service.getEventById(tmEvent.id))?.alsoListedOn, undefined);
});

function detailPair() {
  const tmEvent: EventEntry = {
    ...event("detail-match", "Warehouse Techno", "2030-06-07"),
    venueName: "Warehouse",
    city: "Montreal",
    countryCode: "CA",
    latitude: 45.5017,
    longitude: -73.5673,
    ticketUrl: "https://ticketmaster.example.test/tickets",
    eventUrl: "https://ticketmaster.example.test/event",
    imageUrl: "https://ticketmaster.example.test/image",
  };
  const submission: EventEntry = {
    ...tmEvent,
    id: "submitted-detail",
    source: "submitted",
    sourceEventId: "detail",
    ticketUrl: "https://community.example.test/tickets",
    eventUrl: "https://community.example.test/event",
    description: "Community details",
    imageUrl: undefined,
  };
  return { tmEvent, submission };
}

test("submitted detail uses list merge rules and a 1 km Ticketmaster search cached for five minutes", async (context) => {
  const { tmEvent, submission } = detailPair();
  const tm = provider("ticketmaster", [tmEvent]);
  const submitted = provider("submitted", [submission]);
  const seen: Parameters<EventProvider["search"]>[0][] = [];
  tm.search = async (query) => {
    seen.push(query);
    return { events: [tmEvent], page: 0, totalPages: 1, totalElements: 1 };
  };
  let now = Date.now();
  context.mock.method(Date, "now", () => now);
  const service = createEventService([tm, submitted]);
  const detail = await service.getEventById(submission.id);
  assert.equal(detail?.id, submission.id);
  assert.equal(detail?.description, submission.description);
  assert.equal(detail?.imageUrl, tmEvent.imageUrl);
  assert.deepEqual(detail?.alsoListedOn, [{
    source: "ticketmaster",
    id: tmEvent.id,
    eventUrl: tmEvent.eventUrl,
  }]);
  assert.equal(seen[0].latlong, "45.5017,-73.5673");
  assert.equal(seen[0].city, undefined);
  assert.equal(seen[0].radius, 1);
  assert.equal(seen[0].unit, "km");
  assert.equal(seen[0].localStartDate, "2030-06-06");
  assert.equal(seen[0].localEndDate, "2030-06-08");
  await service.getEventById(submission.id);
  assert.equal(seen.length, 1);
  now += 5 * 60 * 1000;
  await service.getEventById(submission.id);
  assert.equal(seen.length, 2);
});

test("submitted detail searches by city and country when coordinates are missing", async () => {
  const { tmEvent, submission } = detailPair();
  submission.latitude = undefined;
  submission.longitude = undefined;
  // Prefer the community listing so its Ticketmaster duplicate is shown directly.
  tmEvent.ticketUrl = undefined;
  const tm = provider("ticketmaster", [tmEvent]);
  const search = tm.search;
  tm.search = async (query) => {
    assert.equal(query.latlong, undefined);
    assert.equal(query.city, submission.city);
    assert.equal(query.countryCode, submission.countryCode);
    assert.equal(query.radius, 1);
    return search(query);
  };
  const detail = await getEventById(submission.id, [tm, provider("submitted", [submission])]);
  assert.equal(detail?.id, submission.id);
  assert.deepEqual(detail?.alsoListedOn, [{
    source: "ticketmaster",
    id: tmEvent.id,
    eventUrl: tmEvent.eventUrl,
  }]);
  assert.equal(detail?.imageUrl, tmEvent.imageUrl);
});

test("merged-away submitted detail retains its own cancelled status, ID and note", async () => {
  const { tmEvent, submission } = detailPair();
  submission.status = "cancelled";
  submission.changeNote = "Cancelled by organizer";
  const detail = await getEventById(submission.id, [provider("ticketmaster", [tmEvent]), provider("submitted", [submission])]);
  assert.equal(detail?.id, submission.id);
  assert.equal(detail?.status, "cancelled");
  assert.equal(detail?.changeNote, "Cancelled by organizer");
  assert.equal(detail?.alsoListedOn?.[0].id, tmEvent.id);
});

test("Ticketmaster enrichment failure or missing configuration still returns submitted detail", async () => {
  const { tmEvent, submission } = detailPair();
  const tm = provider("ticketmaster", [tmEvent]);
  const service = createEventService([tm, provider("submitted", [submission])]);
  let calls = 0;
  tm.search = async () => {
    calls++;
    throw new ProviderError("Ticketmaster is temporarily unavailable.", 502, "network");
  };
  const detail = await service.getEventById(submission.id);
  assert.equal(detail?.id, submission.id);
  assert.equal(detail?.alsoListedOn, undefined);
  assert.equal(detail?.isElectronic, true);
  await service.getEventById(submission.id);
  assert.equal(calls, 2);
  tm.isConfigured = () => false;
  assert.deepEqual(await service.getEventById(submission.id), detail);
  assert.equal(calls, 2);
});

test("all failed providers propagate the original error", async () => {
  const failed = provider("ticketmaster", []);
  const error = new ProviderError("Ticketmaster rate limit reached. Try again shortly.", 429, "upstream", 429);
  failed.search = async () => { throw error; };
  await assert.rejects(searchEvents(query(), [failed]), (received) => received === error);
});

test("search hides cancelled events by default but allows explicit inclusion", async () => {
  const cancelled = { ...event("cancelled", "Techno Night", "2030-06-07"), status: "cancelled" as const };
  const postponed = { ...event("postponed", "Techno Night", "2030-06-07"), status: "postponed" as const };
  const tm = provider("ticketmaster", [cancelled, postponed]);
  assert.deepEqual((await searchEvents(query(), [tm])).events.map((item) => item.id), ["postponed"]);
  const included = parseEventSearchQuery({ countryCode: "US", includeCancelled: "true" });
  assert.deepEqual((await searchEvents(included, [tm])).events.map((item) => item.id), ["cancelled", "postponed"]);
  assert.throws(() => parseEventSearchQuery({ countryCode: "US", includeCancelled: "yes" }), EventQueryError);
});

test("routes known prefixes and falls back to Ticketmaster for raw or unknown IDs", async () => {
  const seen: string[] = [];
  const tm = provider("ticketmaster", []);
  const other = provider("other", []);
  tm.getById = async (id) => { seen.push(`tm:${id}`); return event(id, "Techno Night", "2030-01-01"); };
  other.getById = async (id) => { seen.push(`other:${id}`); return event(`other-${id}`, "Techno Night", "2030-01-01"); };
  const entries = [tm, other];
  assert.equal((await getEventById("other-123", entries))?.isElectronic, true);
  await getEventById("ticketmaster-123", entries);
  await getEventById("123", entries);
  await getEventById("unknown-123", entries);
  assert.deepEqual(seen, ["other:123", "tm:123", "tm:123", "tm:unknown-123"]);
  other.getById = async () => null;
  assert.equal(await getEventById("other-missing", entries), null);
});

test("public endpoints preserve unconfigured errors and expose partial failure headers", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  delete process.env.TICKETMASTER_API_KEY;
  const tm = provider("ticketmaster", [event("one", "One", "2030-02-01")]);
  const failed = provider("other", []);
  failed.search = async () => { throw new Error("private"); };
  const store = createSubmissionStore(":memory:");
  const unavailableService = createEventService([ticketmasterProvider, createSubmittedProvider(store)]);
  const application = createApp({
    parseEventSearchQuery,
    getEventById: unavailableService.getEventById,
    searchEvents: (input) => input.keyword === "unconfigured"
      ? unavailableService.searchEvents(input)
      : searchEvents(input, [tm, failed]),
  });
  const server = application.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const list = await fetch(`${base}/api/events?countryCode=US`);
    assert.equal(list.status, 200);
    assert.equal(list.headers.get("x-provider-errors"), "other");
    assert.match(list.headers.get("access-control-expose-headers") ?? "", /X-Provider-Errors/i);
    assert.equal(list.headers.get("x-total-elements"), "42");
    assert.equal((await list.json()).length, 1);
    const unavailable = await fetch(`${base}/api/events?countryCode=US&keyword=unconfigured`);
    assert.equal(unavailable.status, 500);
    assert.deepEqual(await unavailable.json(), { error: "Ticketmaster event service is not configured." });
    const detail = await fetch(`${base}/api/events/123`);
    assert.equal(detail.status, 500);
    assert.deepEqual(await detail.json(), { error: "Ticketmaster event service is not configured." });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (priorKey === undefined) delete process.env.TICKETMASTER_API_KEY;
    else process.env.TICKETMASTER_API_KEY = priorKey;
  }
});

test("Ticketmaster page metadata reaches public response headers", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  const priorFetch = globalThis.fetch;
  const store = createSubmissionStore(":memory:");
  const service = createEventService([ticketmasterProvider, createSubmittedProvider(store)]);
  const server = createApp(service, { submissionStore: store }).listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    process.env.TICKETMASTER_API_KEY = "test-credential-not-real";
    globalThis.fetch = async (input) => new Response(JSON.stringify({
      page: new URL(String(input)).searchParams.get("keyword") === "pagination-cap-http"
        ? { number: 0, size: 30, totalElements: 6000, totalPages: 200 }
        : { number: 0, size: 20, totalElements: 120, totalPages: 6 },
      _embedded: {
        events: Array.from({ length: 20 }, (_, index) => ({
          id: `page-event-${index}`,
          name: `Event ${index}`,
          dates: { start: { localDate: "2030-06-14" } },
        })),
      },
    }), { status: 200 });
    const response = await priorFetch(`http://127.0.0.1:${address.port}/api/events?countryCode=US&size=20&keyword=pagination-http`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-page"), "0");
    assert.equal(response.headers.get("x-total-pages"), "6");
    assert.equal(response.headers.get("x-total-elements"), "120");
    assert.equal((await response.json()).length, 20);
    const capped = await priorFetch(`http://127.0.0.1:${address.port}/api/events?countryCode=US&size=30&keyword=pagination-cap-http`);
    assert.equal(capped.status, 200);
    assert.equal(capped.headers.get("x-total-pages"), "34");
    assert.equal(capped.headers.get("x-total-elements"), "6000");
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.TICKETMASTER_API_KEY;
    else process.env.TICKETMASTER_API_KEY = priorKey;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("both real service operations fail when no provider is configured", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  try {
    delete process.env.TICKETMASTER_API_KEY;
    const store = createSubmissionStore(":memory:");
    const service = createEventService([ticketmasterProvider, createSubmittedProvider(store)]);
    const check = (error: unknown) => error instanceof ProviderError && error.statusCode === 500
      && error.message === "Ticketmaster event service is not configured.";
    await assert.rejects(service.searchEvents(query()), check);
    await assert.rejects(service.getEventById("123"), check);
    assert.throws(() => parseEventSearchQuery({ countryCode: "US", type: "invalid" }), EventQueryError);
  } finally {
    if (priorKey === undefined) delete process.env.TICKETMASTER_API_KEY;
    else process.env.TICKETMASTER_API_KEY = priorKey;
  }
});
