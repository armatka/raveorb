const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
let stored = null;
const asyncStorage = {
  async getItem(key) { assert.equal(key, "raveorb.followed-artists.v1"); return stored; },
  async setItem(key, value) { assert.equal(key, "raveorb.followed-artists.v1"); stored = value; },
};
const repository = { calls: [], active: 0, maxActive: 0, handler: async () => [] };
const eventsRepository = {
  async listEvents(filters) {
    repository.calls.push(filters);
    repository.active += 1;
    repository.maxActive = Math.max(repository.maxActive, repository.active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2));
      return await repository.handler(filters);
    } finally { repository.active -= 1; }
  },
};
const shared = {};

function load(relativePath) {
  const filename = path.resolve(root, relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => {
    if (name === "@react-native-async-storage/async-storage") return asyncStorage;
    if (name.endsWith("/eventsRepository") || name === "./eventsRepository") return { eventsRepository, eventsDataMode: "api" };
    if (name.startsWith(".")) {
      const dependency = path.resolve(path.dirname(filename), `${name}.ts`);
      const key = path.relative(root, dependency);
      if (shared[key]) return shared[key];
      if (fs.existsSync(dependency)) return load(key);
    }
    return require(name);
  };
  loaded._compile(output, filename);
  return loaded.exports;
}

const resolver = load("src/lib/artistResolver.ts");
const matching = load("src/lib/artistMatching.ts");
const { followedArtistsStorage } = shared["src/lib/followedArtistsStorage.ts"] = load("src/lib/followedArtistsStorage.ts");
const discoveryLocation = load("src/lib/discoveryLocation.ts");
let settings;
shared["src/lib/discoveryLocation.ts"] = { ...discoveryLocation, loadDiscoverySettings: async () => settings };
const alerts = load("src/services/artistAlertsService.ts");
const { filterDiscoveryEvents, filterElectronicDiscoveryEvents } = load("src/lib/eventDiscovery.ts");
const { getHomeRecommendations } = load("src/lib/homeRecommendations.ts");

const montreal = { label: "Montreal", city: "Montreal", countryCode: "CA", latitude: 45.5, longitude: -73.56 };
const now = new Date(2030, 5, 1, 12);
const event = (id, artists, extra = {}) => ({
  id, title: `Night ${id}`, date: "2030-06-07", startTime: "22:00", venueName: "Hall", city: "Montreal",
  artists, genres: [], type: "club", electronicScore: 0, ...extra,
});
const night = (id, artistsSeen, rating, date = "2029-01-01") => ({ id, artistsSeen, rating, date, eventName: id, venueName: "Hall", city: "Montreal", updatedAt: date });

test.beforeEach(() => {
  stored = null;
  repository.calls = [];
  repository.maxActive = 0;
  repository.handler = async () => [];
  settings = { discoveryLocationConfigured: true, location: montreal, radiusKm: 25 };
  alerts.clearFollowedArtistSearchCache();
});

test("normalizes names and splits b2b and comma lineups", () => {
  assert.equal(resolver.normalizeArtistName("  CHARLOTTE   de Witte "), resolver.normalizeArtistName("Charlotte de Witte"));
  assert.deepEqual(resolver.splitLineupNames("Artist A b2b Artist B"), ["Artist A", "Artist B"]);
  assert.deepEqual(resolver.splitLineupNames("A B2B B"), ["A", "B"]);
  assert.deepEqual(resolver.splitLineupNames("A b3b B b3b C"), ["A", "B", "C"]);
  assert.deepEqual(resolver.splitLineupNames("Artist A,  Artist B, "), ["Artist A", "Artist B"]);
  assert.deepEqual(resolver.splitLineupNames("Above & Beyond"), ["Above & Beyond"]);
  assert.deepEqual([...matching.eventArtistKeys(event("1", ["X b2b Charlotte de Witte", "x"]))], ["x", "charlotte de witte"]);
  const id = resolver.artistId("Charlotte de Witte");
  assert.equal(resolver.resolveArtist(id, [event("1", ["Amelie Lens b2b Charlotte de Witte"])], []).name, "Charlotte de Witte");
});

test("follow and unfollow round trip, de-duplicates by normalized name and serializes writes", async () => {
  await Promise.all([
    followedArtistsStorage.follow("Charlotte de Witte", "manual", now),
    followedArtistsStorage.follow("CHARLOTTE DE WITTE", "suggested", now),
    followedArtistsStorage.follow("Amelie Lens b2b Enrico Sangiuliano", "manual", now),
  ]);
  const listed = await followedArtistsStorage.list();
  assert.deepEqual(listed.map((artist) => artist.normalizedName).sort(), ["amelie lens", "charlotte de witte", "enrico sangiuliano"]);
  assert.equal(listed.find((artist) => artist.normalizedName === "charlotte de witte").source, "manual");
  await followedArtistsStorage.unfollow("charlotte DE witte");
  assert.deepEqual([...await followedArtistsStorage.followedKeys()], ["amelie lens", "enrico sangiuliano"]);
  assert.equal(JSON.parse(stored).version, 1);
});

test("migrates stored entries by re-normalizing, merging duplicates and dropping bad data", async () => {
  stored = JSON.stringify({ version: 1, artists: [
    { name: "Charlotte  de Witte", normalizedName: "stale", followedAt: "2030-02-01T00:00:00.000Z", source: "suggested" },
    { name: "CHARLOTTE DE WITTE", followedAt: "2030-01-01T00:00:00.000Z", source: "manual" },
    { name: "", followedAt: "2030-01-01T00:00:00.000Z" },
    { name: "No date" },
  ] });
  const [artist, ...rest] = await followedArtistsStorage.list();
  assert.equal(rest.length, 0);
  assert.deepEqual(artist, { name: "CHARLOTTE DE WITTE", normalizedName: "charlotte de witte", followedAt: "2030-01-01T00:00:00.000Z", source: "manual" });
  assert.deepEqual(await followedArtistsStorage.listAlerts(now), []);
  const future = JSON.stringify({ version: 2, artists: [] });
  stored = future;
  await assert.rejects(followedArtistsStorage.follow("X"), /unsupported format/);
  assert.equal(stored, future);
});

test("suggests artists seen at 2+ Nights or a Night rated 4+, without followed artists", () => {
  const nights = [
    night("n1", ["Twice b2b Rated", "Once Low"], 3, "2029-01-01"),
    night("n2", ["twice"], 2, "2029-02-01"),
    night("n3", ["Rated", "Followed"], 5, "2029-03-01"),
    night("n4", ["Followed"], 1),
  ];
  const suggestions = matching.getFollowSuggestions(nights, new Set(["followed"]));
  assert.deepEqual(suggestions.map((item) => [item.name, item.reason]), [["Rated", "Seen 2 times"], ["twice", "Seen 2 times"]]);
  assert.deepEqual(matching.getFollowSuggestions([night("n1", ["Solo"], 4)], new Set()).map((item) => item.reason), ["At a Night you rated 4"]);
  assert.deepEqual(matching.getFollowSuggestions([], new Set()), []);
});

test("matches alerts through lineups, ignores past events and counts distinct artists", () => {
  const followed = [{ name: "Charlotte de Witte", normalizedName: "charlotte de witte" }, { name: "Amelie Lens", normalizedName: "amelie lens" }];
  const found = matching.buildArtistAlerts([
    event("a", ["AMELIE LENS b2b Charlotte de Witte"]),
    event("b", ["Amelie Lens"]),
    event("past", ["Amelie Lens"], { date: "2030-05-31" }),
    event("other", ["Someone Else"], { title: "Charlotte de Witte tribute" }),
  ], followed, "2030-06-01", now);
  assert.deepEqual(found.map((alert) => alert.eventId), ["a", "b"]);
  assert.deepEqual(found[0].artistNames, ["Amelie Lens", "Charlotte de Witte"]);
  assert.equal(matching.countAlertArtists(found), 2);
});

test("seen alerts are never announced again and are pruned after the event date", async () => {
  await followedArtistsStorage.follow("Amelie Lens", "manual", now);
  const followed = await followedArtistsStorage.list();
  const found = matching.buildArtistAlerts([event("a", ["Amelie Lens"])], followed, "2030-06-01", now);
  await followedArtistsStorage.recordAlertResults(found, [], now);
  assert.equal(alerts.unseenArtistAlerts(await followedArtistsStorage.listAlerts(now)).length, 1);
  await followedArtistsStorage.markAlertsSeen(["a"], now);
  await followedArtistsStorage.recordAlertResults(found, [], now);
  assert.equal(alerts.unseenArtistAlerts(await followedArtistsStorage.listAlerts(now)).length, 0);
  assert.equal((await followedArtistsStorage.listAlerts(now)).length, 1);
  await followedArtistsStorage.recordAlertResults([], [], new Date(2030, 5, 8));
  assert.deepEqual(JSON.parse(stored).alerts.items, {});
});

test("searches per artist, confirms lineups, throttles for 6 hours and rotates 10 artists 3 at a time", async () => {
  for (let index = 0; index < 12; index++) await followedArtistsStorage.follow(`Artist ${index}`, "manual", new Date(now.getTime() + index));
  repository.handler = async ({ search }) => {
    if (search === "Artist 1") throw new Error("down");
    return [event(`${search}-hit`, [search]), event(`${search}-title`, ["Other"], { title: search })];
  };
  await Promise.all([alerts.refreshArtistAlerts(now), alerts.refreshArtistAlerts(now)]);
  assert.equal(repository.calls.length, 10);
  assert.ok(repository.maxActive <= 3);
  assert.deepEqual(repository.calls[0], {
    latlong: "45.5,-73.56", radius: 25, unit: "km", search: "Artist 0", startDate: "2030-06-01", endDate: "2030-08-30",
    startDateTime: "2030-05-31T00:00:00Z", endDateTime: "2030-08-31T23:59:59Z", size: 50, sort: "date,asc",
  });
  const found = await followedArtistsStorage.listAlerts(now);
  assert.equal(found.length, 9);
  assert.ok(found.every((alert) => alert.eventId.endsWith("-hit")));

  repository.calls = [];
  await alerts.refreshArtistAlerts(new Date(now.getTime() + 6 * 3600000 - 1));
  assert.equal(repository.calls.length, 0);
  repository.handler = async () => [];
  await alerts.refreshArtistAlerts(new Date(now.getTime() + 6 * 3600000));
  assert.deepEqual(repository.calls.slice(0, 3).map((call) => call.search), ["Artist 1", "Artist 10", "Artist 11"]);
  assert.equal(repository.calls.length, 10);

  repository.calls = [];
  settings = { ...settings, radiusKm: 50 };
  await alerts.refreshArtistAlerts(new Date(now.getTime() + 6 * 3600000 + 1));
  assert.equal(repository.calls.length, 10);
});

test("Following chip filters by followed lineups and per-artist results are cached for the session", async () => {
  const keys = new Set(["amelie lens"]);
  const events = [event("a", ["X b2b Amelie Lens"]), event("b", ["Other"])];
  const filters = { city: null, genres: [], type: "all", dateRange: "all-upcoming", followedArtists: keys };
  assert.deepEqual(filterDiscoveryEvents(events, "", filters, now).map((item) => item.id), ["a"]);
  assert.deepEqual(filterDiscoveryEvents(events, "", { ...filters, followedArtists: new Set() }, now), []);
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "following").map((item) => item.id), ["a", "b"]);
  assert.deepEqual(filterElectronicDiscoveryEvents(events, "", "all"), []);

  let fail = true;
  repository.handler = async ({ search }) => {
    if (search === "B" && fail) throw new Error("down");
    return [event(`${search}-1`, [search]), event("shared", ["A, B"])];
  };
  const artists = [{ name: "A", normalizedName: "a" }, { name: "B", normalizedName: "b" }];
  const first = await alerts.searchFollowedArtistEvents(artists, { location: montreal, radiusKm: 25 }, now);
  assert.deepEqual(first.events.map((item) => item.id).sort(), ["A-1", "shared"]);
  assert.deepEqual(first.failed, ["B"]);
  fail = false;
  repository.calls = [];
  const second = await alerts.searchFollowedArtistEvents(artists, { location: montreal, radiusKm: 25 }, now);
  assert.deepEqual(repository.calls.map((call) => call.search), ["B"]);
  assert.deepEqual(second.events.map((item) => item.id).sort(), ["A-1", "B-1", "shared"]);
});

test("Home ranks events with followed artists first", () => {
  const recommendations = getHomeRecommendations([], [
    event("style", ["Other"], { raveOrbCategory: "Techno", date: "2030-06-02" }),
    event("followed", ["Y b2b Amelie Lens"], { date: "2030-06-09" }),
  ], {}, now, 2, null, ["Techno"], new Map([["amelie lens", "Amelie Lens"]]));
  assert.deepEqual(recommendations.map((item) => item.event.id), ["followed", "style"]);
  assert.equal(recommendations[0].reason, "An artist you follow: Amelie Lens");
});
