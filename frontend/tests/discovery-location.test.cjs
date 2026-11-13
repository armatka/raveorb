const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

let stored = null;
let storageError = false;
const asyncStorage = {
  async getItem(key) { assert.equal(key, "raveorb.preferences.v1"); if (storageError) throw new Error("Unavailable"); return stored; },
  async setItem(key, value) { assert.equal(key, "raveorb.preferences.v1"); if (storageError) throw new Error("Unavailable"); stored = value; },
};

function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name === "@react-native-async-storage/async-storage" ? asyncStorage : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

const { preferencesStorage } = loadTypeScript("src/lib/preferencesStorage.ts");
const { groupDiscoveryEvents, filterDiscoveryEvents, filterElectronicDiscoveryEvents } = loadTypeScript("src/lib/eventDiscovery.ts");
const { getHomeRecommendations } = loadTypeScript("src/lib/homeRecommendations.ts");

test.beforeEach(() => { stored = null; storageError = false; });

test("preference persists, clears and preserves unrelated fields", async () => {
  assert.equal((await preferencesStorage.get()).discoveryCity, null);
  stored = JSON.stringify({ futureSetting: "keep" });
  await preferencesStorage.setDiscoveryCity("Toronto");
  assert.equal((await preferencesStorage.get()).discoveryCity, "Toronto");
  assert.equal(JSON.parse(stored).futureSetting, "keep");
  await preferencesStorage.setDiscoveryCity(null);
  assert.equal((await preferencesStorage.get()).discoveryCity, null);
});

test("concurrent preference changes are serialized", async () => {
  await Promise.all([preferencesStorage.setDiscoveryCity("Toronto"), preferencesStorage.setDiscoveryCity("Ottawa")]);
  assert.equal((await preferencesStorage.get()).discoveryCity, "Ottawa");
});

test("invalid preferences and storage errors do not overwrite existing data", async () => {
  stored = "not-json";
  await assert.rejects(preferencesStorage.setDiscoveryCity("Toronto"));
  assert.equal(stored, "not-json");
  storageError = true;
  await assert.rejects(preferencesStorage.get());
});

test("groups tonight, weekend, next seven days and later upcoming once each", () => {
  const now = new Date(2026, 10, 10, 12);
  const events = ["2026-11-10", "2026-11-13", "2026-11-11", "2026-11-17", "2026-11-18"].map((date, index) => ({ id: String(index), date, startTime: "22:00" }));
  const groups = groupDiscoveryEvents(events, now);
  assert.deepEqual(groups.map((group) => group.id), ["tonight", "weekend", "next-7-days", "upcoming"]);
  assert.deepEqual(groups.map((group) => group.data.map((event) => event.date)), [["2026-11-10"], ["2026-11-13"], ["2026-11-11", "2026-11-17"], ["2026-11-18"]]);
});

test("search remains within the selected city", () => {
  const now = new Date(2026, 10, 10, 12);
  const events = ["Toronto", "Ottawa"].map((city) => ({ city, date: "2026-11-11", type: "club", genres: ["techno"], title: "Night", venueName: "Venue", artists: ["Artist"] }));
  const filters = { city: "Toronto", genres: [], type: "all", dateRange: "all-upcoming" };
  assert.deepEqual(filterDiscoveryEvents(events, "artist", filters, now).map((event) => event.city), ["Toronto"]);
  assert.equal(filterDiscoveryEvents(events, "artist", { ...filters, city: null }, now).length, 2);
});

test("electronic discovery applies the threshold unless searching and sorts by date before relevance", () => {
  const events = [
    { id: "house", title: "House artist", date: "2026-11-14", startTime: "22:00", electronicScore: 95, raveOrbCategory: "House", isFestival: false },
    { id: "techno-high", title: "Hard techno", date: "2026-11-13", startTime: "23:00", electronicScore: 96, raveOrbCategory: "Hard Techno", isFestival: false },
    { id: "techno-edge", title: "Techno", date: "2026-11-13", startTime: "21:00", electronicScore: 60, raveOrbCategory: "Techno", isFestival: false },
    { id: "below", title: "Low Artist", date: "2026-11-12", startTime: "20:00", electronicScore: 59, raveOrbCategory: "Other", isFestival: false },
    { id: "festival", title: "House Festival", date: "2026-11-15", startTime: "17:00", electronicScore: 90, raveOrbCategory: "House", isFestival: true },
  ];
  const all = filterElectronicDiscoveryEvents(events, "");
  assert.deepEqual(all.map((event) => event.id), ["techno-high", "techno-edge", "house", "festival"]);
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "House").map((event) => event.id), ["house", "festival"]);
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "festivals").map((event) => event.id), ["festival"]);

  const now = new Date(2026, 10, 12, 12);
  const searchEvents = events.map((event) => ({ ...event, city: "Toronto", venueName: "Venue", artists: [], genres: [] }));
  const dateMatches = filterDiscoveryEvents(searchEvents, "Low Artist", { city: null, genres: [], type: "all", dateRange: "all-upcoming" }, now);
  assert.deepEqual(filterElectronicDiscoveryEvents(dateMatches, "Low Artist").map((event) => event.id), ["below"]);
});

test("RaveOrb style filters expand House and Techno families without mixing Bass categories", () => {
  const events = [
    { id: "deep", date: "2026-11-20", startTime: "20:00", electronicScore: 90, raveOrbCategory: "Deep House" },
    { id: "melodic", date: "2026-11-20", startTime: "21:00", electronicScore: 90, raveOrbCategory: "Melodic House & Techno" },
    { id: "drum-bass", date: "2026-11-20", startTime: "22:00", electronicScore: 90, raveOrbCategory: "Drum & Bass" },
    { id: "dubstep", date: "2026-11-20", startTime: "23:00", electronicScore: 90, raveOrbCategory: "Dubstep / Bass" },
  ];
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "House").map((event) => event.id), ["deep", "melodic"]);
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "Techno").map((event) => event.id), ["melodic"]);
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "Drum & Bass").map((event) => event.id), ["drum-bass"]);
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "Bass").map((event) => event.id), ["dubstep"]);
});

test("Home selects local candidates while retaining cross-city listening history", () => {
  const now = new Date(2026, 10, 10, 12);
  const events = [
    { id: "heard", city: "Ottawa", venueName: "Venue", date: "2026-10-01", startTime: "22:00", genres: ["techno"], artists: ["Artist"] },
    { id: "local", city: "Toronto", venueName: "Venue", date: "2026-11-11", startTime: "22:00", genres: ["techno"], artists: ["Other"] },
    { id: "elsewhere", city: "Ottawa", venueName: "Venue", date: "2026-11-11", startTime: "22:00", genres: ["techno"], artists: ["Other"] },
  ];
  const local = getHomeRecommendations([], events, { heard: "attended" }, now, 3, "Toronto");
  assert.deepEqual(local.map((item) => item.event.id), ["local"]);
  assert.match(local[0].reason, /techno/);
  assert.equal(getHomeRecommendations([], events, {}, now, 3, null).length, 2);
});