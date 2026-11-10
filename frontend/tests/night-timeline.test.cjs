const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/nightTimeline.ts");
const source = fs.readFileSync(filename, "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = new Module(filename, module);
loaded._compile(output, filename);
const { filterNights, getNightFilterOptions, groupNightsByYearMonth } = loaded.exports;

const defaults = { year: null, city: null, venue: null, artist: null, friend: null, rating: "all" };
function night(id, date, overrides = {}) {
  return {
    id, date, eventName: "Afterglow", venueName: "The Room", city: "Toronto",
    artistsSeen: ["Artist One"], friends: ["Alex"], rating: 4, notes: "Laser lights",
    favoriteMoment: "Sunrise finale", photos: [], currency: "CAD", cost: 50,
    createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`, ...overrides,
  };
}
const nights = [
  night("october", "2026-10-12", { eventName: "Other", city: "Amsterdam", rating: 0 }),
  night("older", "2025-12-30", { eventName: "Earlier", artistsSeen: ["Artist Two"], friends: ["Sam"] }),
  night("november", "2026-11-07"),
  night("newest", "2026-11-20", { eventName: "Latest" }),
];

test("groups years and months newest first without mutating input", () => {
  const sections = groupNightsByYearMonth(nights);
  assert.deepEqual(sections.map((section) => section.key), ["2026-11", "2026-10", "2025-12"]);
  assert.deepEqual(sections.map((section) => section.startsYear), [true, false, true]);
  assert.deepEqual(sections[0].data.map((item) => item.id), ["newest", "november"]);
  assert.deepEqual(nights.map((item) => item.id), ["october", "older", "november", "newest"]);
});

test("search includes event, venue, city, artist, friend, notes and favorite moment", () => {
  for (const query of ["AFTERGLOW", "the room", "toronto", "artist one", "alex", "laser lights", "sunrise finale"]) {
    assert.ok(filterNights(nights, ` ${query} `, defaults).some((item) => item.id === "november"), query);
  }
  assert.deepEqual(filterNights(nights, "not present", defaults), []);
});

test("combines year, city, venue, artist, friend and rating filters", () => {
  const filters = { year: "2026", city: "Toronto", venue: "The Room", artist: "Artist One", friend: "Alex", rating: 4 };
  assert.deepEqual(filterNights(nights, "afterglow", filters).map((item) => item.id), ["november"]);
  assert.deepEqual(filterNights(nights, "", { ...filters, friend: "Sam" }), []);
  assert.equal(filterNights(nights, "", { ...defaults, rating: "rated" }).length, 3);
});

test("extracts distinct filter options", () => {
  const options = getNightFilterOptions(nights);
  assert.deepEqual(options.years, ["2026", "2025"]);
  assert.deepEqual(options.cities, ["Amsterdam", "Toronto"]);
  assert.deepEqual(options.venues, ["The Room"]);
  assert.deepEqual(options.artists, ["Artist One", "Artist Two"]);
  assert.deepEqual(options.friends, ["Alex", "Sam"]);
  assert.deepEqual(options.ratings, [4]);
});