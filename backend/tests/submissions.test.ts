import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { createSubmissionStore } from "../src/db/submissions.js";
import { createApp } from "../src/app.js";
import { createSubmittedProvider } from "../src/providers/submitted/index.js";
import type { EventProvider } from "../src/providers/types.js";
import { mapTicketmasterEvent } from "../src/providers/ticketmaster/mapping.js";
import { createEventService } from "../src/services/events.js";
import type { EventEntry } from "../src/types/index.js";

const nextDate = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 5);
  return date.toISOString().slice(0, 10);
};

const dateInNineteenMonths = () => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 19);
  return date.toISOString().slice(0, 10);
};

function submission(overrides: Record<string, unknown> = {}) {
  return {
    title: "Community Techno Night",
    date: nextDate(),
    startTime: "21:00",
    endTime: "03:00",
    timezone: "Europe/Paris",
    venueName: "The Warehouse",
    address: "10 Rue Example",
    city: "Paris",
    region: "Ile-de-France",
    countryCode: "FR",
    latitude: 48.8566,
    longitude: 2.3522,
    artists: ["DJ Example"],
    style: "Techno",
    description: "Independent underground techno event",
    ticketUrl: "https://tickets.example.test/event",
    submitterEmail: "organizer@example.test",
    ...overrides,
  };
}

function ticketmasterStub(ticketmasterEvents: EventEntry[] = []): EventProvider {
  return {
    id: "ticketmaster",
    displayName: "Ticketmaster",
    isConfigured: () => true,
    search: async (query) => ({ events: ticketmasterEvents, page: query.page, totalPages: 1, totalElements: ticketmasterEvents.length }),
    getById: async () => null,
  };
}

function testService(store: ReturnType<typeof createSubmissionStore>, ticketmasterEvents: EventEntry[] = []) {
  const ticketmaster = ticketmasterStub(ticketmasterEvents);
  return createEventService([ticketmaster, createSubmittedProvider(store)]);
}

async function withServer(
  callback: (base: string, store: ReturnType<typeof createSubmissionStore>) => Promise<void>,
  token?: string,
  ticketmasterEvents: EventEntry[] = [],
) {
  const previousToken = process.env.ADMIN_TOKEN;
  if (token === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = token;
  const store = createSubmissionStore(":memory:");
  const server = createApp(testService(store, ticketmasterEvents), {
    submissionStore: store,
    ticketmasterProvider: ticketmasterStub(ticketmasterEvents),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await callback(`http://127.0.0.1:${address.port}`, store);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previousToken;
  }
}

test("validates submissions and counts at most five requests per IP per hour", async () => {
  await withServer(async (base) => {
    for (const invalid of [
      submission({ title: "" }),
      submission({ date: "2020-01-01" }),
      submission({ date: "2030-02-30" }),
      submission({ date: dateInNineteenMonths() }),
      submission({ ticketUrl: "http://tickets.example.test" }),
      submission({ style: "Rock" }),
      submission({ description: "x".repeat(2001) }),
    ]) {
      const response = await fetch(`${base}/api/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invalid),
      });
      assert.equal(response.status, 400);
    }

    for (let index = 0; index < 5; index++) {
      const response = await fetch(`${base}/api/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission()),
      });
      assert.equal(response.status, 201);
      const body = await response.json() as { status: string; id: string };
      assert.equal(body.status, "pending");
      assert.match(body.id, /^[0-9a-f-]{36}$/);
    }
    const limited = await fetch(`${base}/api/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission()),
    });
    assert.equal(limited.status, 429);
  });
});

test("pending submissions are hidden; approved events respect date, keyword, city and distance filters", async () => {
  await withServer(async (base) => {
    const create = await fetch(`${base}/api/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission()),
    });
    const { id } = await create.json() as { id: string };
    const publicId = `submitted-${id}`;
    const hidden = await fetch(`${base}/api/events?city=Paris&countryCode=FR`);
    assert.deepEqual(await hidden.json(), []);
    assert.equal((await fetch(`${base}/api/events/${publicId}`)).status, 404);

    await fetch(`${base}/api/admin/submissions/${id}/approve`, {
      method: "POST",
      headers: { Authorization: "Bearer admin-secret", "content-type": "application/json" },
    }).then((response) => assert.equal(response.status, 200));

    const cityResponse = await fetch(`${base}/api/events?city=Paris&countryCode=FR&keyword=Warehouse&startDate=${nextDate()}`);
    const cityEvents = await cityResponse.json() as Array<Record<string, unknown>>;
    assert.equal(cityResponse.status, 200);
    assert.equal(cityEvents.length, 1);
    assert.equal(cityEvents[0].id, publicId);
    assert.equal(cityEvents[0].raveOrbCategory, "Techno");
    assert.equal(cityEvents[0].isElectronic, true);
    assert.equal(JSON.stringify(cityEvents).includes("organizer@example.test"), false);
    assert.equal(JSON.stringify(await (await fetch(`${base}/api/events/${publicId}`)).json()).includes("organizer@example.test"), false);

    const wrongCity = await fetch(`${base}/api/events?city=London&countryCode=GB`);
    assert.deepEqual(await wrongCity.json(), []);
    const nearby = await fetch(`${base}/api/events?latlong=48.8566,2.3522&radius=10&unit=km`);
    assert.equal((await nearby.json() as unknown[]).length, 1);
    const farAway = await fetch(`${base}/api/events?latlong=51.5072,-0.1276&radius=10&unit=km`);
    assert.deepEqual(await farAway.json(), []);
    const beforeEvent = await fetch(`${base}/api/events?city=Paris&countryCode=FR&endDate=${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}`);
    assert.deepEqual(await beforeEvent.json(), []);
    const laterPage = await fetch(`${base}/api/events?city=Paris&countryCode=FR&page=1`);
    assert.deepEqual(await laterPage.json(), []);
  }, "admin-secret");
});

test("admin endpoints require configured bearer auth and support review operations", async () => {
  await withServer(async (base) => {
    const noConfig = await fetch(`${base}/api/admin/submissions`);
    assert.equal(noConfig.status, 503);
  });

  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/api/admin/submissions`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/submissions`, { headers: { Authorization: "Bearer wrong" } })).status, 401);
    assert.equal((await fetch(`${base}/api/admin/submissions`, { headers: { Authorization: "Bearer admin-secret" } })).status, 200);
    const created = await fetch(`${base}/api/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission()),
    });
    const { id } = await created.json() as { id: string };
    const adminHeaders = { Authorization: "Bearer admin-secret", "content-type": "application/json" };
    const pending = await fetch(`${base}/api/admin/submissions?status=pending`, { headers: adminHeaders }).then((response) => response.json()) as Array<Record<string, unknown>>;
    assert.equal(pending.length, 1);
    assert.equal(pending[0].submitterEmail, "organizer@example.test");
    assert.equal((await fetch(`${base}/api/admin/submissions/${id}/reject`, {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ reason: "Date needs confirmation" }),
    }).then((response) => response.json() as Promise<Record<string, unknown>>)).rejectReason, "Date needs confirmation");
    assert.equal((await fetch(`${base}/api/admin/submissions?status=rejected`, { headers: adminHeaders }).then((response) => response.json() as Promise<Array<unknown>>)).length, 1);
    assert.equal((await fetch(`${base}/api/admin/submissions/${id}`, { method: "DELETE", headers: adminHeaders })).status, 204);
  }, "admin-secret");
});

test("pending admin submissions include matching Ticketmaster events as possible duplicates", async () => {
  const ticketmaster = mapTicketmasterEvent({
    id: "tm-duplicate",
    name: "Community Techno Night",
    dates: { start: { localDate: nextDate(), localTime: "21:00" }, timezone: "Europe/Paris" },
    _embedded: {
      venues: [{
        name: "The Warehouse",
        city: { name: "Paris" },
        country: { countryCode: "FR" },
        location: { latitude: "48.8566", longitude: "2.3522" },
      }],
      attractions: [{ name: "DJ Example" }],
    },
  });
  assert.ok(ticketmaster);
  await withServer(async (base) => {
    await fetch(`${base}/api/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission()),
    }).then((response) => assert.equal(response.status, 201));
    const pending = await fetch(`${base}/api/admin/submissions`, {
      headers: { Authorization: "Bearer admin-secret" },
    }).then((response) => response.json()) as Array<{
      possibleDuplicates: Array<{ id: string; title: string; venueName: string; score: number }>;
    }>;
    assert.equal(pending.length, 1);
    assert.deepEqual(pending[0].possibleDuplicates, [{
      id: "tm-duplicate",
      title: "Community Techno Night",
      venueName: "The Warehouse",
      score: 1,
    }]);
  }, "admin-secret", [ticketmaster]);
});

test("public submission responses never include submitter email", async () => {
  await withServer(async (base, store) => {
    const response = await fetch(`${base}/api/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission()),
    });
    assert.equal(response.status, 201);
    assert.equal(JSON.stringify(await response.json()).includes("organizer@example.test"), false);
    assert.equal(store.list("pending")[0].submitterEmail, "organizer@example.test");
  });
});
