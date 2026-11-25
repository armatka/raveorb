const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, "../src", relative);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => Object.hasOwn(dependencies, id) ? dependencies[id] : originalRequire(id);
  loaded._compile(output, filename);
  return loaded.exports;
}

const resolver = load("lib/artistResolver.ts");
const orbitModule = load("lib/orbit.ts", { "./artistResolver": resolver });
const { buildOrbit, buildShareCardData, homeOrbitYear, homeOrbitReady } = orbitModule;
function night(id, date, overrides = {}) {
  return { id, date, eventName: `Night ${id}`, venueName: "Venue", city: "City", artistsSeen: [], friends: [], rating: 0, cost: 0, currency: "USD", notes: "", favoriteMoment: "", photos: [], ...overrides };
}

test("requires three valid dates in the selected year and keeps the local date boundary", () => {
  const nights = [night("a", "2026-12-30"), night("b", "2026-12-31"), night("c", "2027-01-01"), night("d", "2026-02-30")];
  assert.equal(buildOrbit([], "2026"), null);
  assert.equal(buildOrbit(nights, "2026"), null);
  const orbit = buildOrbit([...nights, night("e", "2026-01-01")], "2026");
  assert.equal(orbit.totalNights, 3);
  assert.equal(orbit.firstNight.id, "e");
  assert.equal(orbit.lastNight.id, "b");
});

test("splits lineups, deduplicates per Night and breaks ties independent of input order", () => {
  const nights = [
    night("a", "2026-01-02", { artistsSeen: ["Zed b2b Alpha", "alpha"], venueName: "Zulu" }),
    night("b", "2026-01-03", { artistsSeen: ["Beta"], venueName: "Alpha" }),
    night("c", "2026-01-04", { artistsSeen: ["Alpha, Beta"], venueName: "Alpha" }),
  ];
  const orbit = buildOrbit(nights, "2026");
  assert.equal(orbit.distinctArtists, 3);
  assert.deepEqual(orbit.topArtists.map((item) => [item.label, item.value]), [["Alpha", 2], ["Beta", 2], ["Zed", 1]]);
  assert.deepEqual(orbit.topVenues.map((item) => [item.label, item.value]), [["Alpha", 2], ["Zulu", 1]]);
  assert.deepEqual(buildOrbit([...nights].reverse(), "2026"), orbit);
});

test("separates currencies and skips costs indistinguishable from unfilled fields", () => {
  const nights = [night("a", "2026-01-01", { cost: 10, currency: "CAD" }), night("b", "2026-01-02", { cost: 20, currency: "USD" }), night("c", "2026-01-03", { cost: 0, currency: "EUR" }), night("d", "2026-01-04", { cost: 5, currency: "CAD" })];
  assert.deepEqual(buildOrbit(nights, "2026").spending, [{ currency: "CAD", total: 15 }, { currency: "USD", total: 20 }]);
  assert.equal(buildOrbit(nights.map((item) => ({ ...item, cost: 0 })), "2026").spending, null);
});

test("Sunday is part of the preceding Friday weekend, including year boundaries and gaps", () => {
  const nights = [
    night("a", "2026-01-04"), // Sunday; Friday was in the previous year
    night("b", "2026-01-09"),
    night("c", "2026-01-11"), // same weekend as b
    night("d", "2026-01-25"), // gap
    night("e", "2026-01-26"), // Monday does not count
  ];
  assert.equal(buildOrbit(nights, "2026").longestWeekendStreak, 2);
  assert.equal(buildOrbit(nights.slice(2), "2026").longestWeekendStreak, 1);
  assert.equal(buildOrbit([night("1", "2026-01-05"), night("2", "2026-01-06"), night("3", "2026-01-07")], "2026").longestWeekendStreak, null);
});

test("style only counts known linked categories; rating, moment and friends stay tied to Nights", () => {
  const nights = [
    night("a", "2026-01-02", { sourceEventId: "a", friends: ["Sam", "sam"], rating: 5, favoriteMoment: "moment" }),
    night("b", "2026-01-03", { sourceEventId: "b", friends: ["Sam", "Alex"], rating: 4 }),
    night("c", "2026-01-04", { sourceEventId: "missing", friends: ["Alex"] }),
  ];
  const events = [{ id: "a", raveOrbCategory: "Techno" }, { id: "b", raveOrbCategory: "Techno" }];
  const orbit = buildOrbit(nights, "2026", events);
  assert.deepEqual(orbit.favouriteStyle, { label: "Techno", value: 2 });
  assert.equal(orbit.favouriteMoment, "moment");
  assert.equal(orbit.highestRatedNight.id, "a");
  assert.deepEqual(orbit.topFriends.map((item) => item.value), [2, 2]);
  assert.equal(buildOrbit(nights, "2026").favouriteStyle, null);
});

test("share projection excludes private fields by default and only opts in friends and spending", () => {
  const nights = [night("a", "2026-01-02", { friends: ["SECRET FRIEND"], cost: 42, notes: "SECRET NOTE", photos: ["SECRET PHOTO"], favoriteMoment: "SECRET MOMENT", rating: 5 }), night("b", "2026-01-03"), night("c", "2026-01-04")];
  const orbit = buildOrbit(nights, "2026");
  const baseline = buildShareCardData(orbit);
  assert.equal("friends" in baseline, false);
  assert.equal("spending" in baseline, false);
  assert.doesNotMatch(JSON.stringify(baseline), /SECRET|42/);
  const opted = buildShareCardData(orbit, { showFriends: true, showSpending: true });
  assert.equal(opted.friends[0].label, "SECRET FRIEND");
  assert.equal(opted.spending[0].total, 42);
  assert.doesNotMatch(JSON.stringify(opted), /SECRET NOTE|SECRET PHOTO|SECRET MOMENT/);
});

test("Home window targets one Orbit year across December and January", () => {
  assert.equal(homeOrbitYear(new Date(2026, 11, 1)), "2026");
  assert.equal(homeOrbitYear(new Date(2027, 0, 31)), "2026");
  assert.equal(homeOrbitYear(new Date(2027, 1, 1)), null);
  assert.equal(homeOrbitYear(new Date(2027, 11, 1)), "2027");
  const nights = [night("a", "2026-01-01"), night("b", "2026-01-02"), night("c", "2026-12-31")];
  assert.equal(homeOrbitReady(nights.slice(0, 2), new Date(2026, 11, 1), null), null);
  assert.equal(homeOrbitReady(nights, new Date(2026, 11, 1), null), "2026");
  assert.equal(homeOrbitReady(nights, new Date(2027, 0, 1), "2026"), null);
  assert.equal(homeOrbitReady(nights, new Date(2027, 1, 1), null), null);
  const next = Array.from({ length: 3 }, (_, i) => night(String(i), "2027-01-01"));
  assert.equal(homeOrbitReady(next, new Date(2027, 11, 1), "2026"), "2027");
});

test("event lookup deduplicates, caps at 50, limits concurrency and caches successes and misses", async () => {
  let active = 0;
  let max = 0;
  const calls = [];
  const repository = { async getEvent(id) {
    calls.push(id);
    max = Math.max(max, ++active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    if (id === "00") throw new Error("offline");
    return id === "01" ? null : { id, raveOrbCategory: "Techno" };
  } };
  const linkedEvents = load("services/linkedEvents.ts", { "./eventsRepository": { eventsRepository: repository } });
  const { loadOrbitEvents } = load("services/orbitEvents.ts", { "./linkedEvents": linkedEvents, "../lib/orbit": orbitModule });
  const nights = Array.from({ length: 55 }, (_, i) => night(String(i), "2026-01-01", { sourceEventId: String(i).padStart(2, "0") }));
  const [first, overlapping] = await Promise.all([loadOrbitEvents(nights, "2026"), loadOrbitEvents(nights, "2026")]);
  assert.equal(max, 3);
  assert.equal(calls.length, 50);
  assert.equal(first.events.length, 48);
  assert.equal(first.failed, 1);
  assert.equal(first.limited, true);
  assert.deepEqual(overlapping, first);
  await loadOrbitEvents(nights, "2026");
  assert.equal(calls.length, 51);
});

test("dismissal is persisted by year", async () => {
  const values = new Map();
  const storage = { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) };
  const { orbitDismissal } = load("lib/orbitDismissal.ts", { "@react-native-async-storage/async-storage": storage });
  assert.equal(await orbitDismissal.get(), null);
  await orbitDismissal.dismiss("2026");
  assert.equal(await orbitDismissal.get(), "2026");
  assert.notEqual(await orbitDismissal.get(), homeOrbitYear(new Date(2027, 11, 1)));
});

test("migrates the previous dismissal and keeps it hidden during its year", async () => {
  const values = new Map([["raveorb.wrapped.dismissed-year.v1", "2026"]]);
  const storage = { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) };
  const { orbitDismissal } = load("lib/orbitDismissal.ts", { "@react-native-async-storage/async-storage": storage });
  const year = await orbitDismissal.get();
  assert.equal(year, "2026");
  assert.equal(values.get("raveorb.orbit.dismissed-year.v1"), "2026");
  const nights = [night("a", "2026-01-01"), night("b", "2026-01-02"), night("c", "2026-01-03")];
  assert.equal(homeOrbitReady(nights, new Date(2027, 0, 1), year), null);
});

test("new dismissal takes precedence and concurrent migration cannot overwrite a later dismissal", async () => {
  const values = new Map([["raveorb.wrapped.dismissed-year.v1", "2026"]]);
  const storage = {
    getItem: async (key) => { await new Promise((resolve) => setTimeout(resolve, 1)); return values.get(key) ?? null; },
    setItem: async (key, value) => values.set(key, value),
  };
  const { orbitDismissal } = load("lib/orbitDismissal.ts", { "@react-native-async-storage/async-storage": storage });
  const [migrated] = await Promise.all([orbitDismissal.get(), orbitDismissal.dismiss("2027")]);
  assert.equal(migrated, "2026");
  assert.equal(await orbitDismissal.get(), "2027");
});

test("migration write failures are surfaced and can be retried", async () => {
  const values = new Map([["raveorb.wrapped.dismissed-year.v1", "2026"]]);
  let fails = true;
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { if (fails) throw new Error("storage failed"); values.set(key, value); },
  };
  const { orbitDismissal } = load("lib/orbitDismissal.ts", { "@react-native-async-storage/async-storage": storage });
  await assert.rejects(orbitDismissal.get(), /storage failed/);
  fails = false;
  assert.equal(await orbitDismissal.get(), "2026");
});

test("Orbit route exports the Orbit screen", () => {
  const screen = () => null;
  assert.equal(load("app/orbit.tsx", { "../screens/OrbitScreen": { __esModule: true, default: screen } }).default, screen);
});

test("Orbit screen presents its title, share card, and empty states with the new name", () => {
  function render(state) {
    const nights = state === "ready" ? [night("a", "2026-01-01"), night("b", "2026-02-01"), night("c", "2026-03-01")] : [];
    const values = [nights, "2026", false, state === "error", 0, { year: "2026", nights, events: [], notice: false }, false, false, true, false, 0];
    let index = 0;
    const component = () => null;
    const dependencies = {
      react: { useCallback: (fn) => fn, useEffect() {}, useMemo: (fn) => fn(), useRef: () => ({ current: null }), useState: (initial) => [index < values.length ? values[index++] : (typeof initial === "function" ? initial() : initial), () => {}] },
      "expo-router": { router: {}, useFocusEffect() {}, useLocalSearchParams: () => ({}) },
      "react-native": {
        ActivityIndicator: "ActivityIndicator", Animated: { Value: class { interpolate() { return 1; } }, ScrollView: "AnimatedScrollView", View: "AnimatedView", event: () => () => {} },
        PixelRatio: {}, Platform: { OS: "ios" }, Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", Switch: "Switch", View: "View",
        StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => ({ width: 375 }),
      },
      "../components/EmptyState": { EmptyState: component }, "../components/Screen": { Screen: component }, "../components/ScreenHeader": { ScreenHeader: component },
      "../lib/formatCurrency": {}, "../lib/navigation": {}, "../lib/nightsStorage": {}, "../lib/showAlert": {}, "../lib/orbit": orbitModule,
      "../services/orbitEvents": {}, "../theme/colors": { colors: {} }, "../theme/spacing": { spacing: { sm: 8, lg: 16, xl: 24 } },
    };
    return load("screens/OrbitScreen.tsx", dependencies).default();
  }
  function find(element, predicate) {
    if (!element || typeof element !== "object") return [];
    if (Array.isArray(element)) return element.flatMap((item) => find(item, predicate));
    return [...(predicate(element) ? [element] : []), ...find(element.props?.children, predicate)];
  }
  const ready = render("ready");
  assert.equal(find(ready, (element) => element.props?.title === "Your Orbit").length, 1);
  assert.equal(find(ready, (element) => element.type === "Text" && Array.isArray(element.props.children) && element.props.children.join("") === "MY 2026 ORBIT · RAVEORB").length, 1);
  assert.equal(find(ready, (element) => element.props?.title === "Share your Orbit").length, 1);
  assert.equal(find(render("empty"), (element) => element.props?.title === "Your Orbit is waiting").length, 1);
  assert.equal(find(render("error"), (element) => element.props?.title === "Orbit unavailable").length, 1);
});
