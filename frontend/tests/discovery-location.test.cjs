const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const stored = new Map();
let storageError = false;
const asyncStorage = {
  async getItem(key) { assert.ok(["raveorb.preferences.v1", "raveorb.preferences.v2"].includes(key)); if (storageError) throw new Error("Unavailable"); return stored.get(key) ?? null; },
  async setItem(key, value) { assert.equal(key, "raveorb.preferences.v2"); if (storageError) throw new Error("Unavailable"); stored.set(key, value); },
};

function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => {
    if (name === "@react-native-async-storage/async-storage") return asyncStorage;
    if (name === "../services/eventsRepository") return { eventsDataMode: "mock" };
    if (name.startsWith(".")) {
      const dependency = path.resolve(path.dirname(filename), `${name}.ts`);
      if (fs.existsSync(dependency)) {
        return loadTypeScript(path.relative(path.resolve(__dirname, ".."), dependency));
      }
    }
    return require(name);
  };
  loaded._compile(output, filename);
  return loaded.exports;
}

const { preferencesStorage } = loadTypeScript("src/lib/preferencesStorage.ts");
const { groupDiscoveryEvents, filterDiscoveryEvents, filterElectronicDiscoveryEvents } = loadTypeScript("src/lib/eventDiscovery.ts");
const {
  DEFAULT_DISCOVERY_LOCATION,
  DEFAULT_DISCOVERY_RADIUS_KM,
  DISCOVERY_RADIUS_OPTIONS,
  allDiscoveryLocationsLabel,
  discoveryEventsQuery,
  discoveryLocationFromCity,
  discoveryLocationToQuery,
  isSameDiscoveryLocation,
  loadDiscoveryLocation,
} = loadTypeScript("src/lib/discoveryLocation.ts");
const { getHomeRecommendations } = loadTypeScript("src/lib/homeRecommendations.ts");

test.beforeEach(() => { stored.clear(); storageError = false; });

test("location preference persists, clears and preserves unrelated fields", async () => {
  assert.equal((await preferencesStorage.get()).discoveryLocation, null);
  stored.set("raveorb.preferences.v2", JSON.stringify({ futureSetting: "keep" }));
  await preferencesStorage.setDiscoveryLocation(DEFAULT_DISCOVERY_LOCATION);
  assert.deepEqual((await preferencesStorage.get()).discoveryLocation, DEFAULT_DISCOVERY_LOCATION);
  assert.equal(JSON.parse(stored.get("raveorb.preferences.v2")).futureSetting, "keep");
  await preferencesStorage.setDiscoveryLocation(null);
  assert.equal((await preferencesStorage.get()).discoveryLocation, null);
});

test("loads the saved location or defaults and labels all locations by country", async () => {
  assert.deepEqual(await loadDiscoveryLocation(), DEFAULT_DISCOVERY_LOCATION);
  const saved = discoveryLocationFromCity("Paris, FR");
  stored.set("raveorb.preferences.v2", JSON.stringify({ discoveryLocation: saved }));
  assert.deepEqual(await loadDiscoveryLocation(), saved);
  assert.equal(allDiscoveryLocationsLabel(), "All of Canada");
});

test("all locations label falls back when Intl.DisplayNames is unavailable", () => {
  const displayNamesDescriptor = Object.getOwnPropertyDescriptor(Intl, "DisplayNames");
  const originalCountryCode = DEFAULT_DISCOVERY_LOCATION.countryCode;
  try {
    Object.defineProperty(Intl, "DisplayNames", {
      configurable: true,
      value: class {
        constructor() { throw new Error("Unsupported"); }
      },
    });
    assert.equal(allDiscoveryLocationsLabel(), "All of Canada");
    DEFAULT_DISCOVERY_LOCATION.countryCode = "ZZ";
    assert.equal(allDiscoveryLocationsLabel(), "All of ZZ");
  } finally {
    DEFAULT_DISCOVERY_LOCATION.countryCode = originalCountryCode;
    if (displayNamesDescriptor) Object.defineProperty(Intl, "DisplayNames", displayNamesDescriptor);
    else delete Intl.DisplayNames;
  }
});

test("v1 city preference migrates to v2 and preserves its city", async () => {
  stored.set("raveorb.preferences.v1", JSON.stringify({ discoveryCity: "London", futureSetting: "keep" }));
  const preferences = await preferencesStorage.get();
  assert.equal(preferences.discoveryLocation.city, "London");
  assert.equal(preferences.discoveryLocation.countryCode, DEFAULT_DISCOVERY_LOCATION.countryCode);
  assert.equal(preferences.discoveryLocation.latitude, undefined);
  assert.equal(preferences.discoveryLocationConfigured, true);
  assert.equal(JSON.parse(stored.get("raveorb.preferences.v2")).futureSetting, "keep");
  assert.equal(JSON.parse(stored.get("raveorb.preferences.v2")).discoveryCity, undefined);
});

test("concurrent location changes are serialized", async () => {
  const montreal = discoveryLocationFromCity("Montreal");
  const ottawa = discoveryLocationFromCity("Ottawa");
  await Promise.all([preferencesStorage.setDiscoveryLocation(montreal), preferencesStorage.setDiscoveryLocation(ottawa)]);
  assert.equal((await preferencesStorage.get()).discoveryLocation.city, "Ottawa");
});

test("saved preference fields validate independently and retain valid fields", async () => {
  const montreal = discoveryLocationFromCity("Montreal");
  stored.set("raveorb.preferences.v2", JSON.stringify({
    savedLocations: [montreal],
    favouriteCategories: ["Techno", "Trance"],
    radiusKm: 75,
    defaultDateRange: "invalid",
  }));
  const preferences = await preferencesStorage.get();
  assert.deepEqual(preferences.savedLocations, [montreal]);
  assert.deepEqual(preferences.favouriteCategories, ["Techno", "Trance"]);
  assert.equal(preferences.radiusKm, DEFAULT_DISCOVERY_RADIUS_KM);
  assert.equal(preferences.defaultDateRange, "all-upcoming");

  stored.set("raveorb.preferences.v2", JSON.stringify({
    savedLocations: [montreal, { city: "", label: "bad", countryCode: "CA" }],
    favouriteCategories: ["House"],
    radiusKm: 100,
    defaultDateRange: "weekend",
  }));
  const independentlyRecovered = await preferencesStorage.get();
  assert.deepEqual(independentlyRecovered.savedLocations, []);
  assert.deepEqual(independentlyRecovered.favouriteCategories, ["House"]);
  assert.equal(independentlyRecovered.radiusKm, 100);
  assert.equal(independentlyRecovered.defaultDateRange, "weekend");
});

test("saved locations compare city, region and country case-insensitively", async () => {
  const ottawaOntario = { label: "Ottawa, Ontario", city: "Ottawa", region: "Ontario", countryCode: "CA" };
  const ottawaIllinois = { label: "Ottawa, Illinois", city: "Ottawa", region: "Illinois", countryCode: "US" };
  const sameOttawa = { label: "OTTAWA", city: "OTTAWA", region: "ONTARIO", countryCode: "ca" };
  assert.equal(isSameDiscoveryLocation(ottawaOntario, sameOttawa), true);
  assert.equal(isSameDiscoveryLocation(ottawaOntario, ottawaIllinois), false);
  await preferencesStorage.setSavedLocations([ottawaOntario, ottawaIllinois]);
  assert.deepEqual((await preferencesStorage.get()).savedLocations, [ottawaOntario, ottawaIllinois]);
  await assert.rejects(preferencesStorage.setSavedLocations([ottawaOntario, sameOttawa]));
  const sixCities = Array.from({ length: 6 }, (_, index) => ({ label: `City ${index}`, city: `City ${index}`, countryCode: "CA" }));
  await assert.rejects(preferencesStorage.setSavedLocations(sixCities));
});

test("saved preference setters retain concurrent updates and reject invalid values", async () => {
  await Promise.all([
    preferencesStorage.setRadiusKm(25),
    preferencesStorage.setFavouriteCategories(["House", "Techno"]),
    preferencesStorage.setDefaultDateRange("weekend"),
  ]);
  const preferences = await preferencesStorage.get();
  assert.equal(preferences.radiusKm, 25);
  assert.deepEqual(preferences.favouriteCategories, ["House", "Techno"]);
  assert.equal(preferences.defaultDateRange, "weekend");
  assert.deepEqual(DISCOVERY_RADIUS_OPTIONS, [10, 25, 50, 100]);
  await assert.rejects(preferencesStorage.setFavouriteCategories(["not-a-style"]));
});

test("invalid preferences and storage errors do not overwrite existing data", async () => {
  stored.set("raveorb.preferences.v2", "not-json");
  await assert.rejects(preferencesStorage.setDiscoveryLocation(DEFAULT_DISCOVERY_LOCATION));
  assert.equal(stored.get("raveorb.preferences.v2"), "not-json");
  storageError = true;
  await assert.rejects(preferencesStorage.get());
});

test("free-text city accepts an explicit country code or inherits the selected country", () => {
  const selected = discoveryLocationFromCity("New York");
  const paris = discoveryLocationFromCity("Paris, FR", selected.countryCode);
  const austin = discoveryLocationFromCity("Austin", selected.countryCode);
  assert.deepEqual({ city: paris.city, countryCode: paris.countryCode }, { city: "Paris", countryCode: "FR" });
  assert.deepEqual({ city: austin.city, countryCode: austin.countryCode }, { city: "Austin", countryCode: "US" });
});

test("coordinate locations query a radius and retain nearby towns in discovery results", () => {
  const query = discoveryLocationToQuery(DEFAULT_DISCOVERY_LOCATION);
  assert.deepEqual(query, {
    latlong: `${DEFAULT_DISCOVERY_LOCATION.latitude},${DEFAULT_DISCOVERY_LOCATION.longitude}`,
    radius: DEFAULT_DISCOVERY_RADIUS_KM,
    unit: "km",
  });
  assert.deepEqual(discoveryEventsQuery(DEFAULT_DISCOVERY_LOCATION), {
    ...query,
    city: DEFAULT_DISCOVERY_LOCATION.city,
  });
  assert.equal(discoveryLocationToQuery(DEFAULT_DISCOVERY_LOCATION, 25).radius, 25);

  const now = new Date(2026, 10, 10, 12);
  const events = ["Toronto", "Mississauga"].map((city) => ({ city, date: "2026-11-11", type: "club", genres: [], title: "Night", venueName: "Venue", artists: [] }));
  const filters = { city: "Toronto", genres: [], type: "all", dateRange: "all-upcoming" };
  assert.deepEqual(filterDiscoveryEvents(events, "", { ...filters, hasCoordinates: true }, now).map((event) => event.city), ["Toronto", "Mississauga"]);
  assert.deepEqual(filterDiscoveryEvents(events, "", { ...filters, hasCoordinates: false }, now).map((event) => event.city), ["Toronto"]);
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
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "favourites", ["Deep House", "Drum & Bass"]).map((event) => event.id), ["deep", "drum-bass"]);
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

test("Home recommendations rank favourite styles and explain the match", () => {
  const now = new Date(2026, 10, 10, 12);
  const events = [
    { id: "ordinary", city: "Toronto", venueName: "Venue", date: "2026-11-11", startTime: "22:00", genres: [], artists: [], raveOrbCategory: "Other" },
    { id: "favourite", city: "Toronto", venueName: "Venue", date: "2026-11-12", startTime: "22:00", genres: [], artists: [], raveOrbCategory: "Techno" },
  ];
  const recommendations = getHomeRecommendations([], events, {}, now, 3, "Toronto", ["Techno"]);
  assert.deepEqual(recommendations.map((item) => item.event.id), ["favourite", "ordinary"]);
  assert.match(recommendations[0].reason, /favourite styles/);
});