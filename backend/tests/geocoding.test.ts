import assert from "node:assert/strict";
import { test } from "node:test";

import { GeocodingError, GeocodingQueryError, searchCities } from "../src/services/geocoding.js";

const ottawa = {
  id: 6094817, name: "Ottawa", admin1: "Ontario", country: "Canada", country_code: "CA",
  latitude: 45.41117, longitude: -75.69812, timezone: "America/Toronto", population: 812129,
};

test("maps cities and sends only the query and fixed search options upstream", async (t) => {
  let requestUrl: URL | undefined;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = new URL(String(input));
    assert.ok(init?.signal);
    assert.deepEqual(init?.headers, { Accept: "application/json" });
    return Response.json({ results: [ottawa] });
  });
  assert.deepEqual(await searchCities("  Ottawa  "), [{
    id: "6094817", label: "Ottawa, Ontario, Canada", city: "Ottawa", region: "Ontario",
    country: "Canada", countryCode: "CA", latitude: 45.41117, longitude: -75.69812,
    timezone: "America/Toronto", population: 812129,
  }]);
  assert.ok(requestUrl);
  assert.equal(requestUrl.origin + requestUrl.pathname, "https://geocoding-api.open-meteo.com/v1/search");
  assert.deepEqual(Object.fromEntries(requestUrl.searchParams), { name: "Ottawa", count: "8", language: "en", format: "json" });
});

test("skips missing country codes and missing, invalid or out-of-range coordinates", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    results: [
      { ...ottawa, country_code: undefined }, { ...ottawa, latitude: undefined },
      { ...ottawa, longitude: undefined }, { ...ottawa, latitude: "45" },
      { ...ottawa, latitude: 91 }, { ...ottawa, longitude: -181 }, null,
      { ...ottawa, id: 1, latitude: 0, longitude: 0, admin1: undefined },
    ],
  }));
  const result = await searchCities("bad-result-fixture");
  assert.equal(result.length, 1);
  assert.equal(result[0].latitude, 0);
  assert.equal(result[0].longitude, 0);
  assert.equal(result[0].label, "Ottawa, Canada");
});

test("rejects short and long queries and invalid limits without fetching", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not fetch"); });
  for (const query of ["", " ", " a ", "a".repeat(81)]) {
    await assert.rejects(searchCities(query), GeocodingQueryError);
  }
  for (const limit of [0, 101, 1.5]) await assert.rejects(searchCities("valid", limit), GeocodingQueryError);
  assert.equal(fetch.mock.callCount(), 0);
});

test("caches normalized queries, isolates limits, and protects cached results from mutations", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ results: [ottawa] }));
  const first = await searchCities("cache-city");
  first[0].city = "Changed";
  assert.equal((await searchCities(" CACHE-CITY "))[0].city, "Ottawa");
  assert.equal(fetch.mock.callCount(), 1);
  await searchCities("cache-city", 3);
  assert.equal(fetch.mock.callCount(), 2);
});

test("cache expires after 24 hours and retains at most 500 entries", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ results: [] }));
  await searchCities("expiry-city");
  now += 24 * 60 * 60 * 1000 - 1;
  await searchCities("expiry-city");
  assert.equal(fetch.mock.callCount(), 1);
  now += 1;
  await searchCities("expiry-city");
  assert.equal(fetch.mock.callCount(), 2);
  for (let index = 0; index < 501; index += 1) await searchCities(`eviction-city-${index}`);
  const calls = fetch.mock.callCount();
  await searchCities("eviction-city-500");
  assert.equal(fetch.mock.callCount(), calls);
  await searchCities("eviction-city-0");
  assert.equal(fetch.mock.callCount(), calls + 1);
});

test("empty responses succeed; provider, network and malformed-response errors are not cached", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}));
  assert.deepEqual(await searchCities("empty-city"), []);
  const failures = [
    async () => new Response("Unavailable", { status: 503 }),
    async () => { throw new Error("network detail should not escape"); },
    async () => new Response("not JSON"),
    async () => Response.json({ results: "invalid" }),
    async () => Response.json({ error: true, reason: "provider detail" }),
  ];
  for (const failure of failures) {
    fetch.mock.mockImplementation(failure);
    await assert.rejects(searchCities("provider-failure-city"), (error: unknown) =>
      error instanceof GeocodingError && error.message === "City search is temporarily unavailable. Please try again.");
  }
  fetch.mock.mockImplementation(async () => Response.json({ results: [ottawa] }));
  assert.equal((await searchCities("provider-failure-city")).length, 1);
});

test("aborts provider requests after eight seconds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  });
  const request = assert.rejects(searchCities("timeout-city"), GeocodingError);
  t.mock.timers.tick(7_999);
  assert.equal(signal?.aborted, false);
  t.mock.timers.tick(1);
  await request;
  assert.equal(signal?.aborted, true);
});
