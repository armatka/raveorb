const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function load(relative, dependencies) {
  const filename = path.resolve(__dirname, "../src", relative);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

function journal() {
  const values = new Map();
  const asyncStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, next) { values.set(key, next); },
    async removeItem(key) { values.delete(key); },
  };
  const { nightsStorage } = load("lib/nightsStorage.ts", {
    "@react-native-async-storage/async-storage": asyncStorage,
    "expo-file-system": {},
    "react-native": { Platform: { OS: "web" } },
  });
  const changes = load("lib/eventChanges.ts", {});
  const { eventStatusStorage } = load("lib/eventStatusStorage.ts", {
    "@react-native-async-storage/async-storage": asyncStorage, "./eventChanges": changes,
  });
  const { beaconStorage } = load("lib/beaconStorage.ts", { "@react-native-async-storage/async-storage": asyncStorage });
  const sampleEvent = load("lib/sampleEvent.ts", { "@react-native-async-storage/async-storage": asyncStorage });
  const sample = load("lib/sampleNights.ts", {
    "./nightsStorage": { nightsStorage }, "./eventStatusStorage": { eventStatusStorage },
    "./beaconStorage": { beaconStorage }, "./sampleEvent": sampleEvent,
  });
  const eventsApi = {
    getEventsApiBaseUrl: () => "https://example.test", hasEventsApi: () => true,
    requestEventsApi: () => { throw new Error("Sample event must not reach the API"); },
  };
  const { eventsRepository } = load("services/eventsRepository.ts", {
    "../data/mockData": { mockEvents: [], mockVenues: [] }, "../types/event": { raveOrbCategories: [] },
    "../lib/sampleEvent": sampleEvent, "./eventsApi": eventsApi,
  });
  return { nightsStorage, eventStatusStorage, beaconStorage, sampleEvent, eventsRepository, ...sample };
}

test("loads eight varied 2026 samples through storage with consecutive weekends and a Sunday", async () => {
  const { nightsStorage, loadSampleNights } = journal();
  await loadSampleNights();
  const nights = await nightsStorage.list();
  assert.equal(nights.length, 8);
  assert.ok(nights.every((night) => night.eventName.startsWith("[Sample]") && night.date.startsWith("2026-")));
  assert.ok(new Set(nights.map((night) => night.date.slice(0, 7))).size >= 6);
  assert.deepEqual(new Set(nights.map((night) => night.city)), new Set(["Toronto", "Montreal"]));
  assert.ok(new Set(nights.map((night) => night.venueName)).size > 2);
  assert.deepEqual(new Set(nights.map((night) => night.currency)), new Set(["CAD", "USD"]));
  assert.ok(nights.every((night) => night.rating >= 3 && night.rating <= 5 && night.cost > 0 && night.friends.length && night.favoriteMoment));
  assert.ok(nights.some((night) => night.artistsSeen.some((artist) => artist.includes(" b2b "))));
  assert.ok(nights.filter((night) => night.artistsSeen.some((artist) => artist.includes("Nova Echo"))).length > 1);
  const dates = nights.map((night) => new Date(`${night.date}T12:00:00Z`));
  assert.ok(dates.some((date) => date.getUTCDay() === 0));
  const weekendFridays = dates.filter((date) => [0, 5, 6].includes(date.getUTCDay()))
    .map((date) => date.getTime() - (date.getUTCDay() === 0 ? 2 : date.getUTCDay() - 5) * 86400000);
  assert.ok(weekendFridays.some((day) => weekendFridays.includes(day + 7 * 86400000)));
});

test("removes only Nights starting with the sample marker, including repeated loads", async () => {
  const { nightsStorage, loadSampleNights, removeSampleNights } = journal();
  const real = { date: "2026-01-01", eventName: "My [Sample] memory", venueName: "Venue", city: "Toronto", artistsSeen: [], friends: [], rating: 4, cost: 0, currency: "CAD", favoriteMoment: "", notes: "", photos: [] };
  const created = await nightsStorage.create(real);
  await loadSampleNights();
  await loadSampleNights();
  assert.equal((await nightsStorage.list()).length, 17);
  await removeSampleNights();
  assert.deepEqual((await nightsStorage.list()).map((night) => night.id), [created.id]);
});

test("loading creates a local Going event within six hours, replaces it on reload and removes its data", async () => {
  const { eventStatusStorage, beaconStorage, sampleEvent, eventsRepository, loadSampleNights, removeSampleNights } = journal();
  await eventStatusStorage.set("real-event", "going");
  const before = Date.now();
  await loadSampleNights();
  const first = await sampleEvent.sampleEventStorage.get();
  const event = await eventsRepository.getEvent(first.id);
  const start = Date.parse(event.dateTime);
  assert.ok(start >= before && start <= Date.now() + 6 * 3600000);
  assert.equal(await eventStatusStorage.get(event.id), "going");
  assert.equal(event.source, "raveorb-local-sample");
  await beaconStorage.set(event.id, { sets: [{ artist: "Alpha", time: "22:00" }], meetingSpot: "Bar" });
  await loadSampleNights();
  const replacement = await sampleEvent.sampleEventStorage.get();
  assert.notEqual(replacement.id, event.id);
  assert.equal(await eventStatusStorage.get(event.id), null);
  assert.equal(await eventsRepository.getEvent(event.id), null);
  assert.equal(await beaconStorage.get(event.id), null);
  assert.equal(await eventStatusStorage.get(replacement.id), "going");
  await removeSampleNights();
  assert.equal(await sampleEvent.sampleEventStorage.get(), null);
  assert.equal(await eventStatusStorage.get(replacement.id), null);
  assert.equal(await eventStatusStorage.get("real-event"), "going");
});

test("sample starts remain timezone-safe near midnight and daylight saving changes", () => {
  const { sampleEvent } = journal();
  const calendar = load("lib/calendarEventDetails.ts", {});
  const overrides = load("lib/beaconDevOverrides.ts", {});
  const { isBeaconWindow, getBeaconStart } = load("lib/beacon.ts", { "./calendarEventDetails": calendar, "./beaconDevOverrides": overrides });
  for (const instant of ["2030-06-08T03:30:45Z", "2030-03-10T05:30:30Z", "2030-11-03T04:30:00Z"]) {
    const now = new Date(instant);
    const event = sampleEvent.createSampleEvent(now);
    const start = getBeaconStart(event);
    assert.ok(start.getTime() - now.getTime() >= 2 * 3600000);
    assert.ok(start.getTime() - now.getTime() <= 6 * 3600000);
    assert.equal(start.toISOString(), event.dateTime);
    assert.equal(isBeaconWindow(event, now), true);
  }
});

test("storage errors stop sample operations and propagate", async () => {
  let attempts = 0;
  const nightsStorage = {
    async create() { if (++attempts === 3) throw new Error("storage failed"); },
    async list() { throw new Error("storage failed"); },
  };
  const sample = load("lib/sampleNights.ts", {
    "./nightsStorage": { nightsStorage }, "./eventStatusStorage": {}, "./beaconStorage": {}, "./sampleEvent": {},
  });
  await assert.rejects(sample.loadSampleNights(), /storage failed/);
  assert.equal(attempts, 3);
  await assert.rejects(sample.removeSampleNights(), /storage failed/);
});

function renderScreen(dev, actions = {}) {
  const component = () => null;
  const dependencies = {
    react: { useCallback: (fn) => fn, useMemo: (fn) => fn(), useRef: (initial) => ({ current: initial }), useState: (initial) => [typeof initial === "boolean" ? false : initial, () => {}] },
    "expo-router": { router: { push: actions.push }, useFocusEffect() {} },
    "react-native": { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", ScrollView: "ScrollView", Switch: "Switch", Text: "Text", View: "View", StyleSheet: { create: (styles) => styles } },
    "@expo/vector-icons": { Ionicons: component },
    "../components/ArtistLinks": {}, "../components/FriendLinks": {},
    "../components/EmptyState": { EmptyState: component }, "../components/Screen": { Screen: component }, "../components/ScreenHeader": { ScreenHeader: component },
    "../lib/eventFormatting": {}, "../lib/discoveryLocation": {}, "../lib/formatCurrency": {}, "../lib/navigation": {},
    "../lib/nightStats": { calculateProfileStats: () => ({ years: [], stats: {} }), calculateNightStats: () => ({}) },
    "../lib/nightsStorage": {}, "../lib/sampleNights": actions, "../lib/showAlert": { showAlert: actions.showAlert },
    "../lib/beaconDevOverrides": {
      useBeaconDevOverrides: () => ({ forceWindow: false, forceAfterEvent: false }),
      setBeaconDevOverride: actions.setBeaconDevOverride,
    },
    "../services/eventsRepository": {}, "../theme/colors": { colors: {} }, "../theme/spacing": { spacing: { sm: 8, lg: 16, xxl: 32 } },
  };
  const screen = load("screens/MyRaveOrbScreen.tsx", dependencies);
  const previous = global.__DEV__;
  global.__DEV__ = dev;
  try { return screen.default(); }
  finally {
    if (previous === undefined) delete global.__DEV__;
    else global.__DEV__ = previous;
  }
}

function findElements(element, predicate) {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap((item) => findElements(item, predicate));
  return [...(predicate(element) ? [element] : []), ...findElements(element.props?.children, predicate)];
}

test("sample controls are present in development even for an empty journal and absent in production", () => {
  const buttons = (screen) => findElements(screen, (element) => ["Load sample Nights", "Remove sample Nights"].includes(element.props?.label));
  assert.deepEqual(buttons(renderScreen(true)).map((element) => element.props.label), ["Load sample Nights", "Remove sample Nights"]);
  assert.equal(buttons(renderScreen(false)).length, 0);
});

test("Beacon switches are development-only and update independent overrides", () => {
  const calls = [];
  const screen = renderScreen(true, { setBeaconDevOverride: (...args) => calls.push(args) });
  const switches = findElements(screen, (element) => element.type === "Switch");
  assert.deepEqual(switches.map((item) => item.props.accessibilityLabel), ["Force Beacon window", "Force after event"]);
  switches[0].props.onValueChange(true);
  switches[1].props.onValueChange(true);
  assert.deepEqual(calls, [["forceWindow", true], ["forceAfterEvent", true]]);
  assert.equal(findElements(renderScreen(false), (element) => element.type === "Switch").length, 0);
});

test("My RaveOrb links the Orbit row to its route", () => {
  const paths = [];
  const screen = renderScreen(false, { push: (path) => paths.push(path) });
  const row = findElements(screen, (element) => element.props?.label === "Orbit")[0];
  assert.equal(row.props.value, "Your year in Nights");
  assert.equal(row.props.accessibilityLabel, "Open Orbit");
  row.props.onPress();
  assert.deepEqual(paths, ["/orbit"]);
});

test("sample button handlers invoke storage actions and report partial failures", async () => {
  const calls = [];
  const alerts = [];
  const screen = renderScreen(true, {
    loadSampleNights: async () => { calls.push("load"); },
    removeSampleNights: async () => { calls.push("remove"); throw new Error("storage failed"); },
    showAlert: (...args) => alerts.push(args),
  });
  const buttons = findElements(screen, (element) => ["Load sample Nights", "Remove sample Nights"].includes(element.props?.label));
  await buttons[0].props.onPress();
  await buttons[1].props.onPress();
  assert.deepEqual(calls, ["load", "remove"]);
  assert.match(alerts[0][1], /storage failed.*may have been removed/);
});
