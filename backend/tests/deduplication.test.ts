import assert from "node:assert/strict";
import { test } from "node:test";

import type { EventEntry } from "../src/types/index.js";
import { deduplicateEvents, isLikelySameEvent } from "../src/services/deduplication.js";

function event(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    id: "ticketmaster-1",
    source: "ticketmaster",
    title: "Warehouse Rave",
    type: "rave",
    venueId: "venue-1",
    venueName: "The Warehouse",
    city: "Montreal",
    countryCode: "CA",
    latitude: 45.5017,
    longitude: -73.5673,
    date: "2030-06-07",
    startTime: "23:00",
    endTime: "03:00",
    timezone: "America/Toronto",
    artists: [],
    genres: [],
    description: "",
    sourceEventId: "1",
    ...overrides,
  };
}

test("matches city-decorated titles after removing each event's own city", () => {
  const first = event({ title: "Charlotte de Witte presents Warehouse", city: "Montreal" });
  const second = event({
    id: "submitted-2",
    source: "submitted",
    title: "Warehouse Charlotte de Witte Live Montreal Tickets",
    city: "Montreal",
  });
  const result = isLikelySameEvent(first, second);
  assert.equal(result.match, true);
  assert.ok(result.reasons.includes("similar-title"));
});

test("does not match same titles on different nights", () => {
  assert.equal(isLikelySameEvent(event(), event({
    id: "submitted-2",
    source: "submitted",
    date: "2030-06-09",
  })).match, false);
});

test("does not match same venue names across different cities", () => {
  assert.equal(isLikelySameEvent(event(), event({
    id: "submitted-2",
    source: "submitted",
    city: "Toronto",
    latitude: undefined,
    longitude: undefined,
  })).match, false);
});

test("matches venue coordinates at 300 metres but not beyond", () => {
  const latitudeOffset = (meters: number) => meters / 6_371_008.8 * 180 / Math.PI;
  const first = event({ title: "Charlotte de Witte" });
  const atBoundary = event({
    id: "submitted-2",
    source: "submitted",
    title: "Charlotte de Witte",
    venueName: "Different venue",
    latitude: first.latitude! + latitudeOffset(300),
  });
  const outsideBoundary = { ...atBoundary, latitude: first.latitude! + latitudeOffset(301) };
  assert.equal(isLikelySameEvent(first, atBoundary).match, true);
  assert.equal(isLikelySameEvent(first, outsideBoundary).match, false);
});

test("matches dissimilar titles when at least one normalized artist is shared", () => {
  const first = event({ title: "Warehouse Night", artists: ["Élodie"] });
  const second = event({
    id: "submitted-2",
    source: "submitted",
    title: "After Hours",
    artists: ["Elodie"],
  });
  const result = isLikelySameEvent(first, second);
  assert.equal(result.match, true);
  assert.ok(result.reasons.includes("shared-artist"));
});

test("matches similar normalized venue names", () => {
  assert.equal(isLikelySameEvent(event({ venueName: "The Warehouse", latitude: undefined, longitude: undefined }), event({
    id: "submitted-2",
    source: "submitted",
    venueName: "Warehouse Annex",
    latitude: undefined,
    longitude: undefined,
  })).match, true);
});

test("matches adjacent late-night dates within four hours across midnight", () => {
  const result = isLikelySameEvent(event({ date: "2030-06-07", startTime: "23:00" }), event({
    id: "submitted-2",
    source: "submitted",
    date: "2030-06-08",
    startTime: "00:30",
  }));
  assert.equal(result.match, true);
  assert.ok(result.reasons.includes("adjacent-date-late-night"));
});

test("does not match adjacent dates when start times are not within four hours", () => {
  assert.equal(isLikelySameEvent(event({ date: "2030-06-07", startTime: "20:00" }), event({
    id: "submitted-2",
    source: "submitted",
    date: "2030-06-08",
    startTime: "20:00",
  })).match, false);
});

test("never matches events from the same provider", () => {
  assert.deepEqual(isLikelySameEvent(event(), event({ id: "ticketmaster-2" })), {
    match: false,
    score: 0,
    reasons: ["same-provider"],
  });
});

test("chooses a primary, records other listings, and fills only missing fields", () => {
  const community = event({
    id: "submitted-2",
    source: "submitted",
    title: "Warehouse Rave",
    ticketUrl: "https://community.example.test/tickets",
    artists: [],
    description: "",
  });
  const ticketmaster = event({
    id: "ticketmaster-1",
    ticketUrl: undefined,
    eventUrl: "https://ticketmaster.example.test/event",
    artists: ["DJ Example"],
    description: "Ticketmaster details",
    imageUrl: "https://images.example.test/event.jpg",
  });
  const [merged] = deduplicateEvents([ticketmaster, community]);
  assert.equal(merged.id, community.id);
  assert.equal(merged.description, "Ticketmaster details");
  assert.deepEqual(merged.artists, ["DJ Example"]);
  assert.equal(merged.imageUrl, "https://images.example.test/event.jpg");
  assert.deepEqual(merged.alsoListedOn, [{
    source: "ticketmaster",
    id: ticketmaster.id,
    eventUrl: ticketmaster.eventUrl,
  }]);

  const bothWithTickets = deduplicateEvents([
    community,
    { ...ticketmaster, ticketUrl: "https://ticketmaster.example.test/tickets" },
  ]);
  assert.equal(bothWithTickets[0].source, "ticketmaster");

  const existingDetails = deduplicateEvents([{
    ...community,
    description: "Primary description",
    artists: ["Primary artist"],
    imageUrl: "https://community.example.test/image.jpg",
  }, ticketmaster])[0];
  assert.equal(existingDetails.description, "Primary description");
  assert.deepEqual(existingDetails.artists, ["Primary artist"]);
  assert.equal(existingDetails.imageUrl, "https://community.example.test/image.jpg");
});

test("uses the event with more populated fields when higher preferences tie", () => {
  const lessFilled = event({ source: "provider-a", ticketUrl: undefined });
  const moreFilled = event({
    id: "provider-b-2",
    source: "provider-b",
    ticketUrl: undefined,
    address: "100 Example Street",
    imageUrl: "https://images.example.test/event.jpg",
  });
  assert.equal(deduplicateEvents([lessFilled, moreFilled])[0].id, moreFilled.id);
});

test("venue-name containment requires a normalized shorter name of four characters", () => {
  const first = event({ venueName: "X", latitude: undefined, longitude: undefined });
  const second = event({
    id: "submitted-2",
    source: "submitted",
    venueName: "X Arena",
    latitude: undefined,
    longitude: undefined,
  });
  assert.equal(isLikelySameEvent(first, second).match, false);
});
