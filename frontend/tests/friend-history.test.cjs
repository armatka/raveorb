const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/friendHistory.ts");
const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = new Module(filename, module);
loaded._compile(output, filename);
const { getFriendHistory, normalizeFriendName } = loaded.exports;

function night(id, date, overrides = {}) {
  return { id, date, updatedAt: date, eventName: id, friends: [], city: "Toronto", venueName: "Venue", artistsSeen: [], rating: 0, photos: [], ...overrides };
}

test("matches trimmed case variants once per Night and keeps distinct names separate", () => {
  const nights = [night("older", "2025-01-01", { friends: [" Jeremy ", "JEREMY"], rating: 5 }), night("newer", "2026-01-01", { friends: ["jeremy"], rating: 3 }), night("other", "2026-02-01", { friends: ["Jeremy Smith"] })];
  const history = getFriendHistory(" Jeremy ", nights);
  assert.equal(normalizeFriendName(" Jeremy "), "jeremy");
  assert.deepEqual(history.nights.map((item) => item.id), ["newer", "older"]);
  assert.equal(history.name, "jeremy");
  assert.equal(history.averageRating, 4);
  assert.equal(history.mostRecentNight.id, "newer");
  assert.deepEqual(getFriendHistory("", nights).nights, []);
});

test("counts artists and venues per Night and reuses unique photo URIs", () => {
  const nights = [
    night("one", "2026-01-01", { friends: ["Jeremy"], artistsSeen: ["ARTBAT", "artbat"], city: "Toronto", venueName: "Rebel", rating: 4, photos: ["file://one", "file://two"] }),
    night("two", "2026-02-01", { friends: ["jeremy"], artistsSeen: ["Artbat", "Other"], city: "toronto", venueName: "rebel", rating: 0, photos: ["file://one"] }),
    night("three", "2026-03-01", { friends: ["Else"], photos: ["file://three"] }),
  ];
  const history = getFriendHistory("JEREMY", nights);
  assert.deepEqual(history.cities.map((item) => item.count), [2]);
  assert.equal(history.mostFrequentVenue.count, 2);
  assert.equal(history.mostFrequentArtist.count, 2);
  assert.equal(history.artists.length, 2);
  assert.equal(history.averageRating, 4);
  assert.deepEqual(history.photos.map((photo) => photo.uri), ["file://one", "file://two"]);
  assert.equal(history.photos[0].nightId, "two");
  assert.equal(nights[0].friends[0], "Jeremy");
});

test("empty and unknown history produces no invented metrics", () => {
  const history = getFriendHistory("Unknown", []);
  assert.equal(history.name, "");
  assert.equal(history.averageRating, null);
  assert.equal(history.mostFrequentArtist, null);
  assert.equal(history.mostRecentNight, null);
  assert.deepEqual(history.photos, []);
});