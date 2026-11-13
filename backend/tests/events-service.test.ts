import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { createApp } from "../src/app.js";
import { createSubmissionStore } from "../src/db/submissions.js";
import { mapTicketmasterEvent } from "../src/providers/ticketmaster/mapping.js";
import { createSubmittedProvider } from "../src/providers/submitted/index.js";
import { ticketmasterProvider } from "../src/providers/ticketmaster/index.js";
import type { EventProvider, ProviderPage } from "../src/providers/types.js";
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

test("all failed providers propagate the original error", async () => {
  const failed = provider("ticketmaster", []);
  const error = new ProviderError("Ticketmaster rate limit reached. Try again shortly.", 429, "upstream", 429);
  failed.search = async () => { throw error; };
  await assert.rejects(searchEvents(query(), [failed]), (received) => received === error);
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
