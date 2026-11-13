import assert from "node:assert/strict";
import { test } from "node:test";

import { mapTicketmasterEvent } from "../src/providers/ticketmaster/mapping.js";
import { getEventById, parseEventSearchQuery as parseTicketmasterQuery, searchEvents as searchTicketmasterEvents, ProviderError as TicketmasterError, EventQueryError as TicketmasterQueryError } from "../src/services/events.js";

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
  assert.equal(event.segment, "Music");
  assert.equal(event.genre, "Electronic");
  assert.equal(event.subgenre, "House");
  assert.deepEqual(event.classifications, [{ genre: { name: "Electronic" }, subGenre: { name: "House" }, segment: { name: "Music" } }]);
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
  assert.throws(
    () => parseTicketmasterQuery({ city: "Paris" }),
    (error: unknown) => error instanceof TicketmasterQueryError
      && error.message === "countryCode is required unless latlong is provided.",
  );
  assert.equal(parseTicketmasterQuery({ latlong: "48.8566,2.3522" }).countryCode, undefined);
  assert.throws(() => parseTicketmasterQuery({ page: "-1" }), TicketmasterQueryError);
  assert.throws(() => parseTicketmasterQuery({ startDate: "2030-02-30" }), TicketmasterQueryError);
  assert.throws(() => parseTicketmasterQuery({ startDate: "2030-06-02", endDate: "2030-06-01" }), TicketmasterQueryError);
  assert.throws(() => parseTicketmasterQuery({ apiKey: "should-not-be-forwarded" }), TicketmasterQueryError);
});

test("electronicOnly filters events after classification", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  const priorFetch = globalThis.fetch;
  try {
    process.env.TICKETMASTER_API_KEY = "test-credential-not-real";
    globalThis.fetch = async () => new Response(JSON.stringify({
      page: { number: 0, size: 20, totalPages: 1, totalElements: 2 },
      _embedded: {
        events: [
          { id: "electronic-only-techno", name: "Techno Night", dates: { start: { localDate: "2030-06-14" } }, classifications: [{ genre: { name: "Techno" } }] },
          { id: "electronic-only-rock", name: "Rock Night", dates: { start: { localDate: "2030-06-15" } }, classifications: [{ genre: { name: "Rock" } }] },
        ],
      },
    }), { status: 200 });

    const filters = parseTicketmasterQuery({ keyword: "electronic-only filter test", countryCode: "US", electronicOnly: "true" });
    const result = await searchTicketmasterEvents(filters);

    assert.equal(filters.electronicOnly, true);
    assert.deepEqual(result.events.map((event) => event.id), ["electronic-only-techno"]);
    assert.equal(result.events[0].isElectronic, true);
    assert.equal(result.events[0].raveOrbCategory, "Techno");
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.TICKETMASTER_API_KEY;
    else process.env.TICKETMASTER_API_KEY = priorKey;
  }
});

test("latlong searches work without countryCode and omit it upstream", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  const priorFetch = globalThis.fetch;
  let requestUrl: URL | undefined;
  try {
    process.env.TICKETMASTER_API_KEY = "test-credential-not-real";
    globalThis.fetch = async (input) => {
      requestUrl = new URL(String(input));
      return new Response(JSON.stringify({
        page: { number: 0, size: 20, totalPages: 1, totalElements: 0 },
        _embedded: { events: [] },
      }), { status: 200 });
    };

    await searchTicketmasterEvents(parseTicketmasterQuery({ latlong: "48.8566,2.3522", radius: "50" }));
    assert.ok(requestUrl);
    assert.equal(requestUrl.searchParams.get("latlong"), "48.8566,2.3522");
    assert.equal(requestUrl.searchParams.get("radius"), "50");
    assert.equal(requestUrl.searchParams.has("countryCode"), false);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.TICKETMASTER_API_KEY;
    else process.env.TICKETMASTER_API_KEY = priorKey;
  }
});

test("prefers page metadata, falls back to _page, and caps page counts by requested size", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  const priorFetch = globalThis.fetch;
  try {
    process.env.TICKETMASTER_API_KEY = "test-credential-not-real";
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      const keyword = url.searchParams.get("keyword");
      const metadata = { number: 2, size: 20, totalPages: 2000, totalElements: 6000 };
      return new Response(JSON.stringify({
        ...(keyword === "pagination-fallback" ? { _page: metadata } : { page: metadata, _page: { number: 9, totalPages: 1, totalElements: 1 } }),
        _embedded: { events: [] },
      }), { status: 200 });
    };

    for (const [size, expectedPages] of [[20, 50], [30, 34], [1, 1000]] as const) {
      const result = await searchTicketmasterEvents(parseTicketmasterQuery({
        keyword: `pagination-${size}`, countryCode: "US", size: String(size), page: "2",
      }));
      assert.deepEqual([result.page, result.totalPages, result.totalElements], [2, expectedPages, 6000]);
      assert.ok((expectedPages - 1) * size < 1000);
      assert.ok(expectedPages * size >= 1000);
    }
    const fallback = await searchTicketmasterEvents(parseTicketmasterQuery({ keyword: "pagination-fallback", countryCode: "US" }));
    assert.deepEqual([fallback.page, fallback.totalPages, fallback.totalElements], [2, 50, 6000]);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.TICKETMASTER_API_KEY;
    else process.env.TICKETMASTER_API_KEY = priorKey;
  }
});

test("returns sanitized errors for upstream failures", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  const priorFetch = globalThis.fetch;
  try {
    delete process.env.TICKETMASTER_API_KEY;
    await assert.rejects(
      searchTicketmasterEvents(parseTicketmasterQuery({ keyword: "unconfigured service test", countryCode: "US" })),
      (error: unknown) => error instanceof TicketmasterError
        && error.statusCode === 500
        && error.message === "Ticketmaster event service is not configured.",
    );

    process.env.TICKETMASTER_API_KEY = "test-credential-not-real";
    globalThis.fetch = async () => new Response("{}", { status: 429 });
    await assert.rejects(
      searchTicketmasterEvents(parseTicketmasterQuery({ keyword: "isolated rate-limit test", countryCode: "US" })),
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

test("preserves Ticketmaster options, legacy filters, and request-time configuration across cached results", async () => {
  const priorKey = process.env.TICKETMASTER_API_KEY;
  const priorFetch = globalThis.fetch;
  const urls: URL[] = [];
  try {
    process.env.TICKETMASTER_API_KEY = "test-credential-not-real";
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      const entries = [
        { id: "cache-house", name: "House Club", dates: { start: { localDate: "2030-06-15" } }, classifications: [{ genre: { name: "House" } }] },
        { id: "cache-rock", name: "Rock Club", dates: { start: { localDate: "2030-06-16" } }, classifications: [{ genre: { name: "Rock" } }] },
        { id: "cache-outside", name: "House Club", dates: { start: { localDate: "2030-07-01" } }, classifications: [{ genre: { name: "House" } }] },
      ];
      return new Response(JSON.stringify(url.pathname.endsWith("/events.json")
        ? { page: { number: 0, size: 20, totalPages: 7, totalElements: 100 }, _embedded: { events: entries } }
        : entries[0]), { status: 200 });
    };
    const filters = parseTicketmasterQuery({
      keyword: "legacy filter cache", countryCode: "US", classificationName: "Dance", genreId: "123",
      genre: "house", type: "club", startDate: "2030-06-01", endDate: "2030-06-30",
      startDateTime: "2030-05-01T00:00:00Z", endDateTime: "2030-08-01T00:00:00Z",
    });
    const result = await searchTicketmasterEvents(filters);
    assert.deepEqual(result.events.map((item) => item.id), ["cache-house"]);
    assert.deepEqual([result.totalPages, result.totalElements], [7, 100]);
    assert.equal(urls[0].searchParams.get("classificationName"), "Dance");
    assert.equal(urls[0].searchParams.get("genreId"), "123");
    assert.equal(urls[0].searchParams.get("startDateTime"), "2030-05-01T00:00:00Z");
    const unfiltered = await searchTicketmasterEvents({ ...filters, providerOptions: { ticketmaster: { classificationName: "Dance", genreId: "123" } }, localStartDate: undefined, localEndDate: undefined });
    assert.equal(unfiltered.events.length, 3);
    assert.equal(urls.length, 1);
    assert.equal((await getEventById("cache-house"))?.isElectronic, true);
    assert.equal(urls.length, 2);
    delete process.env.TICKETMASTER_API_KEY;
    await assert.rejects(searchTicketmasterEvents(filters), TicketmasterError);
    await assert.rejects(getEventById("cache-house"), TicketmasterError);
    assert.equal(urls.length, 2);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.TICKETMASTER_API_KEY;
    else process.env.TICKETMASTER_API_KEY = priorKey;
  }
});