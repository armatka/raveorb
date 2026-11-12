const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/artistResolver.ts");
const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = new Module(filename, module);
loaded._compile(output, filename);
const { artistId, resolveArtist, getArtistHistory, getArtistUpcomingEvents } = loaded.exports;

test("artist identity is case-insensitive, Unicode-safe and URL-safe", () => {
  assert.equal(artistId("  ARTBAT  "), artistId("artbat"));
  assert.equal(artistId("Café"), artistId("Cafe\u0301"));
  assert.match(artistId("A/B & C"), /^artist-[0-9a-f-]+$/);
  assert.notEqual(artistId("A/B"), artistId("A B"));
  assert.equal(artistId("  "), "");
});

test("resolve catalog spelling and genres or fall back to journal names", () => {
  const events = [{ artists: ["ARTBAT"], genres: ["Techno"] }, { artists: ["artbat"], genres: ["techno", "House"] }];
  const nights = [{ artistsSeen: ["Artbat"] }];
  assert.deepEqual(resolveArtist(artistId("artbat"), events, nights), { id: artistId("ARTBAT"), name: "ARTBAT", genres: ["Techno", "House"] });
  assert.equal(resolveArtist(artistId("Artbat"), [], nights).name, "Artbat");
  assert.equal(resolveArtist(artistId("missing"), events, nights), null);
});

test("history counts Nights once, newest first, excluding unrated from average", () => {
  const nights = [
    { date: "2025-01-01", updatedAt: "a", artistsSeen: ["ARTBAT", "artbat"], city: "Toronto", venueName: "Venue", rating: 5 },
    { date: "2026-01-01", updatedAt: "a", artistsSeen: ["Artbat"], city: "toronto", venueName: "Other", rating: 0 },
    { date: "2026-02-01", updatedAt: "a", artistsSeen: ["Someone else"], city: "Paris", venueName: "X", rating: 1 },
  ];
  const history = getArtistHistory(artistId("ARTBAT"), nights);
  assert.equal(history.nights.length, 2);
  assert.equal(history.nights[0].date, "2026-01-01");
  assert.equal(history.cities.length, 1);
  assert.equal(history.venues.length, 2);
  assert.equal(history.averageRating, 5);
});

test("upcoming matches are case-insensitive, sorted and exclude past events", () => {
  const events = ["2026-11-12", "2026-11-09", "2026-11-10"].map((date) => ({ date, startTime: "22:00", artists: ["Artbat"] }));
  assert.deepEqual(getArtistUpcomingEvents(artistId("ARTBAT"), events, "2026-11-10").map((event) => event.date), ["2026-11-10", "2026-11-12"]);
});