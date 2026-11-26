const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name in mocks ? mocks[name] : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

const planner = load("src/lib/festivalPlanner.ts");
const event = {
  id: "festival", title: "Festival", type: "festival", venueId: "v", venueName: "Park",
  city: "Toronto", countryCode: "CA", date: "2030-06-07", startTime: "18:00",
  endTime: "04:00", timezone: "America/Toronto", artists: ["Alpha", "Beta"], genres: [],
  description: "", source: "test",
};
function set(id, day, start, end, extra = {}) {
  return { id, artist: id, stage: "Main", day, start, end, starred: true, ...extra };
}
function plan(sets) {
  return { ...planner.createFestivalPlan(event), days: ["2030-06-07", "2030-06-08"], sets };
}

test("festival early hours sort after Friday evening and overlap across midnight", () => {
  const friday = "2030-06-07";
  const saturday = "2030-06-08";
  const result = planner.sortedSets(plan([
    set("early", friday, "01:00", "02:00", { stage: "Tent" }),
    set("late", friday, "23:30", "01:30"),
    set("next", saturday, "06:00", "07:00"),
    set("adjacent", friday, "02:00", "03:00"),
  ]), true);
  assert.deepEqual(result.map((item) => item.set.id), ["late", "early", "adjacent", "next"]);
  assert.deepEqual(planner.clashesFor(result[0], result).map((item) => item.set.id), ["early"]);
  assert.deepEqual(planner.clashesFor(result[2], result), []);
  const updated = planner.keepSet(plan(result.map((item) => item.set)), "early");
  assert.equal(updated.sets.length, 4);
  assert.equal(updated.sets.find((item) => item.id === "late").starred, false);
  assert.equal(updated.sets.find((item) => item.id === "early").starred, true);
  assert.deepEqual(planner.beaconSetsFromPlan(plan([set("early", friday, "01:00", "02:00")])), [{ artist: "early", time: "2030-06-07 · 01:00 (+1 day)" }]);
});

test("keeping one set does not unstar sets that only clash transitively", () => {
  const day = "2030-06-07";
  const original = plan([
    set("A", day, "21:00", "22:30"),
    set("B", day, "22:00", "23:30"),
    set("C", day, "23:00", "00:00"),
  ]);
  const result = planner.keepSet(original, "A");
  assert.deepEqual(result.sets.map((item) => item.starred), [true, false, true]);
  assert.equal(result.sets.length, 3);
});

test("gaps are measured after the union of overlapping sets", () => {
  const day = "2030-06-07";
  const result = planner.sortedSets(plan([
    set("long", day, "21:00", "23:00"),
    set("short", day, "22:00", "22:30"),
    set("later", day, "23:45", "00:30"),
  ]), true);
  assert.deepEqual([...planner.scheduleGaps(result)], [["later", 45]]);
});

test("ordering uses festival days, not the device timezone", () => {
  const previous = process.env.TZ;
  const source = plan([set("one", "2030-06-07", "01:00", "02:00"), set("two", "2030-06-07", "23:00", "00:00")]);
  try {
    process.env.TZ = "America/Los_Angeles";
    const west = planner.sortedSets(source);
    process.env.TZ = "Asia/Tokyo";
    assert.deepEqual(planner.sortedSets(source), west);
    assert.deepEqual(west.map((item) => item.set.id), ["two", "one"]);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("storage round trips, migrates v0 and rejects corrupt or future versions", async () => {
  const values = new Map();
  const asyncStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
    async getAllKeys() { return [...values.keys()]; },
  };
  const { festivalPlannerStorage: storage } = load("src/lib/festivalPlannerStorage.ts", {
    "@react-native-async-storage/async-storage": { __esModule: true, default: asyncStorage },
    "./festivalPlanner": planner,
  });
  const original = plan([set("one", "2030-06-07", "23:00", "01:00")]);
  await storage.set(original);
  assert.deepEqual(await storage.get(event.id), original);
  assert.deepEqual(await storage.list(), [original]);
  const key = "raveorb.festival-plan.v1.festival";
  values.set(key, JSON.stringify({ ...original, version: 0, sets: [{ ...original.sets[0], starred: undefined }] }));
  const migrated = await storage.get(event.id);
  assert.equal(migrated.version, 1);
  assert.equal(migrated.sets[0].starred, false);
  await storage.set(migrated);
  assert.equal(JSON.parse(values.get(key)).version, 1);
  values.set(key, JSON.stringify({ ...original, version: 99 }));
  await assert.rejects(storage.get(event.id), /unsupported/);
  values.set(key, "{bad");
  await assert.rejects(storage.get(event.id), /could not be read/);
});

test("sample festival loads and removes only its own event and plan", async () => {
  const values = new Map([["unrelated", "keep"]]);
  const asyncStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
    async getAllKeys() { return [...values.keys()]; },
  };
  const { festivalPlannerStorage } = load("src/lib/festivalPlannerStorage.ts", {
    "@react-native-async-storage/async-storage": asyncStorage, "./festivalPlanner": planner,
  });
  let status = null;
  const sample = load("src/lib/sampleFestival.ts", {
    "@react-native-async-storage/async-storage": asyncStorage,
    "./festivalPlanner": planner, "./festivalPlannerStorage": { festivalPlannerStorage },
    "./beaconStorage": { beaconStorage: { async remove() {} } },
    "./eventStatusStorage": { eventStatusStorage: { async remove() { status = null; }, async set(_id, next) { status = next; } } },
  });
  const loaded = await sample.loadSampleFestival();
  const saved = await festivalPlannerStorage.get(loaded.id);
  assert.equal(loaded.artists.length, 10);
  assert.equal(saved.stages.length, 3);
  assert.equal(saved.days.length, 2);
  assert.equal(status, "going");
  assert.equal((await sample.sampleFestivalStorage.get()).id, loaded.id);
  await sample.removeSampleFestival();
  assert.equal(await festivalPlannerStorage.get(loaded.id), null);
  assert.equal(await sample.sampleFestivalStorage.get(), null);
  assert.equal(values.get("unrelated"), "keep");
});

test("event lookup uses saved snapshot only for connection failures", async () => {
  let requestError = new Error("The event service could not be reached. Check the API URL and connection.");
  const { eventsRepository } = load("src/services/eventsRepository.ts", {
    "../data/mockData": { mockEvents: [], mockVenues: [] },
    "../types/event": { raveOrbCategories: [] },
    "../lib/sampleEvent": { SAMPLE_EVENT_ID_PREFIX: "sample-" },
    "../lib/sampleFestival": { SAMPLE_FESTIVAL_ID: "sample-festival" },
    "../lib/festivalPlannerStorage": { festivalPlannerStorage: { async get() { return plan([]); } } },
    "./eventsApi": { getEventsApiBaseUrl: () => "api", hasEventsApi: () => true, requestEventsApi: async () => { throw requestError; } },
  });
  assert.deepEqual(await eventsRepository.getEvent(event.id), event);
  requestError = new Error("The event service returned invalid JSON.");
  await assert.rejects(eventsRepository.getEvent(event.id), /invalid JSON/);
});

test("Beacon follows starred plan until manually edited, then offers replacement", () => {
  const one = plan([set("Alpha", event.date, "23:00", "00:00")]);
  const two = plan([set("Beta", event.date, "23:30", "00:30")]);
  const initial = { sets: [], meetingSpot: "Bar", setsEditedManually: false };
  const synced = planner.synchronizeBeaconSets(initial, one);
  assert.deepEqual(synced.details.sets, [{ artist: "Alpha", time: "2030-06-07 · 23:00" }]);
  const changed = planner.synchronizeBeaconSets(synced.details, two);
  assert.deepEqual(changed.details.sets, [{ artist: "Beta", time: "2030-06-07 · 23:30" }]);
  const manual = { ...synced.details, setsEditedManually: true, sets: [{ artist: "Personal", time: "22:00" }] };
  const kept = planner.synchronizeBeaconSets(manual, two);
  assert.deepEqual(kept.details, manual);
  assert.equal(kept.canUsePlan, true);
  const replaced = { ...manual, sets: kept.planSets, setsEditedManually: false };
  assert.deepEqual(planner.synchronizeBeaconSets(replaced, one).details.sets, synced.details.sets);
  const fallback = [{ artist: "Lineup", time: "" }];
  assert.deepEqual(planner.synchronizeBeaconSets(replaced, plan([]), fallback).details.sets, fallback);
  assert.equal(planner.synchronizeBeaconSets({ ...manual, setsEditedManually: undefined }, two).canUsePlan, true);
});

test("journal prefill receives only starred artists", () => {
  const calendar = load("src/lib/calendarEventDetails.ts");
  const overrides = load("src/lib/beaconDevOverrides.ts");
  const beacon = load("src/lib/beacon.ts", { "./calendarEventDetails": calendar, "./beaconDevOverrides": overrides });
  const festival = plan([set("Alpha", event.date, "23:00", "00:00"), set("Beta", event.date, "22:00", "23:00", { starred: false })]);
  assert.equal(beacon.nightPrefill(event, planner.beaconSetsFromPlan(festival)).artists, "Alpha");
});

test("Beacon screen preserves manual edits and lets the user restore a changed plan", async () => {
  const slots = [];
  let hook = 0;
  let focus;
  let saved = null;
  let currentPlan = plan([set("Alpha", event.date, "23:00", "00:00")]);
  const routes = [];
  const checkedDates = [];
  const react = {
    useCallback: (fn) => fn,
    useRef(initial) {
      const index = hook++;
      return slots[index] ??= { current: initial };
    },
    useState(initial) {
      const index = hook++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
  };
  const screen = load("src/screens/BeaconScreen.tsx", {
    react,
    "expo-keep-awake": { useKeepAwake() {} },
    "expo-location": {},
    "expo-router": { router: { push: (route) => routes.push(route) }, useFocusEffect: (fn) => { focus = fn; }, useIsFocused: () => true, useLocalSearchParams: () => ({ id: event.id }) },
    "react-native": { ActivityIndicator: "ActivityIndicator", Linking: {}, Platform: {}, Pressable: "Pressable", Share: {}, StyleSheet: { create: (styles) => styles }, Text: "Text", TextInput: "TextInput", View: "View" },
    "../components/Screen": { Screen: "Screen" },
    "../lib/eventStatusStorage": { eventStatusStorage: { async get() { return "going"; } } },
    "../lib/eventFormatting": { formatEventSchedule: () => "" },
    "../lib/beacon": { isAfterEvent: (item) => { checkedDates.push(item.date); return true; }, nightPrefill: (_event, sets) => ({ artists: sets.map((item) => item.artist).join("|") }) },
    "../lib/beaconDevOverrides": { useBeaconDevOverrides() {} },
    "../lib/beaconStorage": { beaconStorage: { async get() { return saved; }, async set(_id, details) { saved = details; } } },
    "../lib/festivalPlanner": planner,
    "../lib/festivalPlannerStorage": { festivalPlannerStorage: { async get() { return currentPlan; } } },
    "../lib/navigation": {}, "../lib/showAlert": {},
    "../services/eventsRepository": { eventsRepository: { async getEvent() { return event; } } },
  });
  const render = () => { hook = 0; return screen.default(); };
  const find = (element, predicate) => {
    if (!element || typeof element !== "object") return [];
    if (Array.isArray(element)) return element.flatMap((item) => find(item, predicate));
    return [...(predicate(element) ? [element] : []), ...find(element.props?.children, predicate)];
  };
  const button = (tree, title) => find(tree, (item) => item.props?.title === title)[0];
  render();
  let cleanup = focus();
  await new Promise((resolve) => setImmediate(resolve));
  let tree = render();
  assert.equal(checkedDates.at(-1), "2030-06-08");
  let artist = find(tree, (item) => item.props?.accessibilityLabel === "Artist 1")[0];
  assert.equal(artist.props.value, "Alpha");
  artist.props.onChangeText("Manual");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saved.setsEditedManually, true);
  cleanup();
  currentPlan = plan([set("Beta", event.date, "23:30", "00:30")]);
  cleanup = focus();
  await new Promise((resolve) => setImmediate(resolve));
  tree = render();
  artist = find(tree, (item) => item.props?.accessibilityLabel === "Artist 1")[0];
  assert.equal(artist.props.value, "Manual");
  button(tree, "Log this Night").props.onPress();
  assert.equal(routes[0].params.artists, "Beta");
  button(tree, "Use my festival plan").props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(saved.sets, [{ artist: "Beta", time: "2030-06-07 · 23:30" }]);
  assert.equal(saved.setsEditedManually, false);
  cleanup();
});
