const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loader(overrides = {}) {
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const filename = path.resolve(__dirname, "../src", relative);
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    loaded.require = (id) => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id.startsWith(".")) {
        const base = path.resolve(path.dirname(filename), id);
        for (const suffix of [".ts", ".tsx"]) {
          if (fs.existsSync(base + suffix)) return load(path.relative(path.resolve(__dirname, "../src"), base + suffix));
        }
      }
      return require(id);
    };
    loaded._compile(output, filename);
    cache.set(relative, loaded.exports);
    return loaded.exports;
  }
  return load;
}

const load = loader();
const { buildTasteProfile } = load("lib/tasteProfile.ts");
const { getHomeRecommendations, scoreRecommendation, sortEventsForYou } = load("lib/homeRecommendations.ts");
const now = new Date(2026, 10, 25, 12);
const night = (id, date, rating, extra = {}) => ({ id, date, rating, venueName: "Rebel", city: "Toronto", artistsSeen: ["Charlotte de Witte"], ...extra });
const event = (id, extra = {}) => ({ id, title: id, date: "2026-12-01", startTime: "22:00", city: "Toronto", venueName: "Other", artists: [], genres: [], ...extra });
const profile = (nights = [], followed = new Map(), categories = [], linked = []) => buildTasteProfile(nights, followed, { favouriteCategories: categories }, linked, now);

test("weights ratings, venues and linked categories with a calendar-year recency boundary", () => {
  const nights = [
    night("1", "2026-10-01", 5, { sourceEventId: "tech" }),
    night("2", "2025-11-25", 4, { sourceEventId: "tech" }),
    night("3", "2025-11-24", 3, { sourceEventId: "tech" }),
    night("4", "2026-01-01", 2, { sourceEventId: "tech" }),
    night("5", "2026-01-02", 1, { sourceEventId: "tech" }),
    night("6", "2026-01-03", 0, { sourceEventId: "tech" }),
  ];
  const taste = profile(nights, new Map(), ["Techno"], [{ id: "tech", raveOrbCategory: "Techno" }]);
  assert.equal(taste.artists.get("charlotte de witte").score, 4.5);
  assert.equal(taste.venues.get("rebel").score, 2.25);
  assert.equal(taste.categories.get("Techno").score, 8.5);
  assert.equal(profile([night("old", "2024-01-01", 5)]).artists.get("charlotte de witte").score, 2.5);
});

test("lineups are normalized and counted once per Night; following adds six", () => {
  const nights = [night("1", "2026-01-01", 5, { artistsSeen: ["A b2b B", "a", " B "] })];
  const taste = profile(nights, new Map([["a", "A"]]));
  assert.equal(taste.artists.get("a").score, 11);
  assert.equal(taste.artists.get("b").score, 5);
  assert.equal(taste.artists.size, 2);
});

test("negative ratings penalize artists, venues and categories without inventing praise", () => {
  const taste = profile([night("bad", "2026-01-01", 1, { sourceEventId: "linked" })], new Map(), [], [{ id: "linked", raveOrbCategory: "House" }]);
  assert.equal(taste.artists.get("charlotte de witte").score, -2);
  assert.equal(taste.venues.get("rebel").score, -1);
  assert.equal(taste.categories.get("House").score, -2);
  const result = scoreRecommendation(event("candidate", { venueName: "Rebel", artists: ["Charlotte de Witte"], raveOrbCategory: "House" }), taste, now);
  assert.equal(result.score, -5);
  assert.equal(result.reason, "Upcoming event in Discovery");
});

test("reasons are grounded in the matched artist, venue or selected style", () => {
  const taste = profile([night("good", "2026-01-01", 5)]);
  assert.equal(scoreRecommendation(event("artist", { artists: ["Charlotte de Witte"] }), taste, now).reason, "Because you rated a Night with Charlotte de Witte at Rebel 5★");
  assert.equal(scoreRecommendation(event("venue", { venueName: "Rebel" }), taste, now).reason, "You rated a Night at Rebel 5★");
  assert.equal(scoreRecommendation(event("style", { raveOrbCategory: "Techno" }), profile([], new Map(), ["Techno"]), now).reason, "One of your favourite styles: Techno");
  assert.equal(scoreRecommendation(event("follow", { artists: ["A b2b B"] }), profile([], new Map([["b", "B"]])), now).reason, "An artist you follow: B");
});

test("Home excludes going, attended and not-interested events, and ties use stable event IDs", () => {
  const events = [event("z"), event("b"), event("a"), event("excluded"), event("going"), event("attended")];
  const statuses = { going: "going", attended: "attended" };
  const rank = (items) => getHomeRecommendations([], items, statuses, now, 10, null, [], new Map(), [], new Set(["excluded"])).map((item) => item.event.id);
  assert.deepEqual(rank(events), ["a", "b", "z"]);
  assert.deepEqual(rank([...events].reverse()), ["a", "b", "z"]);
});

test("Home returns up to ten ranked events with evidence-based reasons", () => {
  const events = Array.from({ length: 12 }, (_, index) => event(String(index).padStart(2, "0"), {
    artists: index === 11 ? ["A b2b B"] : [],
  }));
  const picks = getHomeRecommendations([], events, {}, now, 10, null, [], new Map([["b", "B"]]));
  assert.equal(picks.length, 10);
  assert.equal(picks[0].event.id, "11");
  assert.equal(picks[0].reason, "An artist you follow: B");
});

test("weekend adds a small boost including Sunday; Discovery ranks not-interested last", () => {
  const sunday = new Date(2026, 10, 29, 12);
  const taste = profile([], new Map([["a", "A"]]));
  const weekend = event("weekend", { date: "2026-11-29" });
  const followed = event("followed", { date: "2026-11-30", artists: ["A"] });
  const hidden = event("hidden", { date: "2026-11-29", artists: ["A"] });
  assert.equal(scoreRecommendation(weekend, taste, sunday).reason, "Happening this weekend");
  assert.deepEqual(sortEventsForYou([hidden, weekend, followed], taste, new Set(["hidden"]), sunday).map((item) => item.event.id), ["followed", "weekend", "hidden"]);
});

test("cold start retains the prior discovery ordering and reasons", () => {
  assert.equal(profile().coldStart, true);
  assert.equal(profile([], new Map([["a", "A"]])).coldStart, false);
  const events = [event("weekend", { date: "2026-11-28" }), event("sooner", { date: "2026-11-26" })];
  assert.deepEqual(getHomeRecommendations([], events, {}, now).map(({ event: item, reason }) => [item.id, reason]), [
    ["sooner", "Upcoming event in Discovery"], ["weekend", "Upcoming event in Discovery"],
  ]);
  assert.deepEqual(sortEventsForYou(events, profile(), new Set(["sooner"]), now).map((item) => item.event.id), ["weekend", "sooner"]);
  assert.equal(sortEventsForYou(events, profile(), new Set(), now)[0].reason, "Upcoming event in Discovery");
});

test("not-interested preferences persist, serialize and can be undone without overwriting corrupt data", async () => {
  const values = new Map();
  const storage = { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) };
  const localLoad = loader({ "@react-native-async-storage/async-storage": storage });
  const { notInterestedStorage } = localLoad("lib/notInterestedStorage.ts");
  await Promise.all([notInterestedStorage.set("a", true), notInterestedStorage.set("b", true)]);
  assert.deepEqual(await notInterestedStorage.list(), ["a", "b"]);
  await notInterestedStorage.set("a", false);
  assert.deepEqual(await notInterestedStorage.list(), ["b"]);
  values.set("raveorb.not-interested.v1", "{");
  await assert.rejects(notInterestedStorage.set("c", true), /could not be read/);
  assert.equal(values.get("raveorb.not-interested.v1"), "{");
});

test("linked events include all distinct IDs with bounded concurrency and retry failures", async () => {
  let active = 0;
  let maximum = 0;
  const calls = [];
  const repository = { async getEvent(id) {
    calls.push(id);
    maximum = Math.max(maximum, ++active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    if (id === "bad") throw new Error("offline");
    return id === "missing" ? null : { id };
  } };
  const localLoad = loader({ "./eventsRepository": { eventsRepository: repository } });
  const { loadLinkedEvents } = localLoad("services/linkedEvents.ts");
  const ids = [...Array.from({ length: 55 }, (_, i) => String(i)), "bad", "missing", "1"];
  const result = await loadLinkedEvents(ids);
  assert.equal(result.events.length, 55);
  assert.equal(result.failed, 1);
  assert.equal(maximum, 3);
  assert.equal(calls.length, 57);
  await loadLinkedEvents(ids);
  assert.equal(calls.length, 58);
});

test("event card exposes not-interested and undo actions separately from opening the event", async () => {
  const component = () => null;
  const localLoad = loader({
    "react-native": { Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: (styles) => styles } },
    "expo-router": { router: {} }, "expo-image": { Image: component }, "@expo/vector-icons": { Ionicons: component },
    "./ArtistLinks": { ArtistLinks: component }, "../lib/eventFormatting": { formatEventPrice: () => "", formatEventSchedule: () => "" },
    "../theme/colors": { colors: {} }, "../theme/spacing": { spacing: {} },
  });
  const { EventListItem } = localLoad("components/EventListItem.tsx");
  const changes = [];
  const item = event("event", { artists: [], genres: [] });
  const find = (element, label) => {
    if (!element || typeof element !== "object") return [];
    if (Array.isArray(element)) return element.flatMap((child) => find(child, label));
    return [...(element.props?.accessibilityLabel === label ? [element] : []), ...find(element.props?.children, label)];
  };
  const render = (notInterested) => EventListItem({ event: item, notInterested, onNotInterestedChange: async (value) => changes.push(value) });
  find(render(false), "Not interested in event")[0].props.onPress();
  find(render(true), "Undo not interested in event")[0].props.onPress();
  assert.deepEqual(changes, [true, false]);
});
