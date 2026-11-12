import assert from "node:assert/strict";
import { test } from "node:test";

import { mapTicketmasterEvent, parseTicketmasterQuery, searchTicketmasterEvents, TicketmasterError, TicketmasterQueryError } from "../src/services/ticketmaster.js";

test("maps Ticketmaster events to the shared event contract", () => {
  const event = mapTicketmasterEvent({
    id: "tm-123",
    name: "Night Pulse",
    url: "https://example.test/tickets",
    dates: { start: { localDate: "2030-06-14", localTime: "21:30", dateTime: "2030-06-15T01:30:00Z" }, timezone: "America/Toronto", status: { code: "onsale" } },
    classifications: [{ genre: { name: "Electronic" }, subGenre: { name: "House" }, segment: { name: "Music" } }],
    priceRanges: [{ min: 25, max: 80, currency: "CAD" }],
    images: [{ url: "https://example.test/poster.jpg", width: 1200, ratio: "16_9" }],
    _embedded: {
      venues: [{ id: "venue-1", name: "The Hall", city: { name: "Toronto" }, state: { name: "Ontario" }, country: { name: "Canada", countryCode: "CA" } }],
      attractions: [{ name: "DJ Example" }],
    },
  });

  assert.ok(event);
  assert.equal(event.id, "tm-123");
  assert.equal(event.sourceEventId, "tm-123");
  assert.equal(event.date, "2030-06-14");
  assert.equal(event.startTime, "21:30");
  assert.equal(event.province, "Ontario");
  assert.deepEqual(event.artists, ["DJ Example"]);
  assert.deepEqual(event.genres, ["Electronic", "House"]);
  assert.equal(event.priceMin, 25);
  assert.equal(event.currency, "CAD");
  assert.equal(event.status, "scheduled");
  assert.equal(mapTicketmasterEvent({ id: "missing-date", name: "No date" }), null);
});

test("validates Discovery query values and date ranges", () => {
  const filters = parseTicketmasterQuery({ city: "Toronto", countryCode: "ca", page: "2", size: "20", startDate: "2030-06-01", endDate: "2030-06-30" });
  assert.equal(filters.countryCode, "CA");
  assert.equal(filters.page, 2);
  assert.equal(filters.startDateTime, "2030-06-01T00:00:00Z");
  assert.throws(() => parseTicketmasterQuery({ page: "-1" }), TicketmasterQueryError);
  assert.throws(() => parseTicketmasterQuery({ startDate: "2030-02-30" }), TicketmasterQueryError);
  assert.throws(() => parseTicketmasterQuery({ startDate: "2030-06-02", endDate: "2030-06-01" }), TicketmasterQueryError);
  assert.throws(() => parseTicketmasterQuery({ apiKey: "should-not-be-forwarded" }), TicketmasterQueryError);
});

test("returns sanitized errors for upstream failures", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  const priorFetch = globalThis.fetch;
  try {
    delete process.env.TICKETMASTER_API_KEY;
    await assert.rejects(
      searchTicketmasterEvents(parseTicketmasterQuery({ keyword: "unconfigured service test" })),
      (error: unknown) => error instanceof TicketmasterError
        && error.statusCode === 500
        && error.message === "Ticketmaster event service is not configured.",
    );

    process.env.TICKETMASTER_API_KEY = "test-credential-not-real";
    globalThis.fetch = async () => new Response("{}", { status: 429 });
    await assert.rejects(
      searchTicketmasterEvents(parseTicketmasterQuery({ keyword: "isolated rate-limit test" })),
      (error: unknown) => error instanceof TicketmasterError
        && error.statusCode === 429
        && error.message === "Ticketmaster rate limit reached. Try again shortly."
        && !error.message.includes("test-credential-not-real"),
    );
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.TICKETMASTER_API_KEY;
    else process.env.TICKETMASTER_API_KEY = priorKey;
  }
});