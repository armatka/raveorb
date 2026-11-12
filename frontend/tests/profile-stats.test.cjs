const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/nightStats.ts");
const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = new Module(filename, module);
loaded._compile(output, filename);
const { calculateNightStats, calculateProfileStats } = loaded.exports;

function night(id, date, overrides = {}) {
  return { id, date, city: "Toronto", venueName: "Venue", artistsSeen: ["ARTBAT", "artbat"], friends: ["Sam"], rating: 4, cost: 10, currency: "CAD", photos: ["photo"], ...overrides };
}

test("profile shares Stats totals and separates currency and years", () => {
  const nights = [night("a", "2026-01-01"), night("b", "2025-12-01", { currency: "USD", cost: 20, rating: 0 }), night("c", "2026-02-01", { currency: "EUR", cost: 30, city: "Ottawa" })];
  const profile = calculateProfileStats(nights);
  assert.deepEqual(profile.stats, calculateNightStats(nights, null));
  assert.deepEqual(profile.stats.spending.map((item) => [item.currency, item.total]), [["CAD", 10], ["USD", 20], ["EUR", 30]]);
  assert.equal(profile.firstNightDate, "2025-12-01");
  assert.equal(profile.mostRecentNightDate, "2026-02-01");
  assert.equal(profile.topArtists[0].value, 3);
  assert.equal(profile.topArtists[0].mostRecentDate, "2026-02-01");
  assert.equal(calculateNightStats(nights, "2025").totalNights, 1);
  assert.deepEqual(profile.mostActiveYear, ["2026", 2]);
  assert.deepEqual(profile.mostActiveMonth, ["2026-02", 1]);
});

test("genres use only explicitly linked events and count once per Night", () => {
  const nights = [night("a", "2026-01-01", { sourceEventId: "one" }), night("b", "2026-01-02"), night("c", "2026-01-03", { sourceEventId: "missing" })];
  const profile = calculateProfileStats(nights, [{ id: "one", genres: ["Techno", "techno", "House"] }]);
  assert.equal(profile.linkedGenreNightCount, 1);
  assert.deepEqual(profile.topGenres, [{ label: "House", value: 1 }, { label: "Techno", value: 1 }]);
  assert.deepEqual(calculateProfileStats(nights, []).topGenres, []);
});

test("milestones are awarded only at thresholds and track next target", () => {
  const nights = Array.from({ length: 10 }, (_, index) => night(String(index), "2026-01-01"));
  const before = calculateProfileStats(nights.slice(0, 9)).milestones[0];
  assert.deepEqual(before.achieved, []);
  assert.equal(before.next, 10);
  const [milestone] = calculateProfileStats(nights).milestones;
  assert.deepEqual(milestone.achieved, [10]);
  assert.equal(milestone.next, 25);
  assert.equal(milestone.current, 10);
  const empty = calculateProfileStats([]);
  assert.deepEqual(empty.milestones[0].achieved, []);
  assert.equal(empty.milestones[0].next, 10);
});

test("year recap uses only selected-year Nights and profile shows at most five artists", () => {
  const nights = [
    night("a", "2025-01-01", { artistsSeen: ["A", "B", "C", "D", "E", "F"], city: "Toronto", photos: ["one", "two"] }),
    night("b", "2026-01-01", { artistsSeen: ["Other"], city: "Ottawa", photos: ["three"] }),
  ];
  const recap = calculateNightStats(nights, "2025");
  assert.equal(recap.totalNights, 1);
  assert.equal(recap.uniqueArtists, 6);
  assert.equal(recap.uniqueCities, 1);
  assert.equal(recap.totalPhotos, 2);
  assert.equal(calculateProfileStats(nights).topArtists.length, 5);
});