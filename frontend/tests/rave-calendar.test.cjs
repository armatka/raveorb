const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "../src", file);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name in mocks ? mocks[name] : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

const dates = load("lib/calendarDate.ts");
const calendar = load("lib/raveCalendar.ts", { "./calendarDate": dates });
const snapshot = {
  title: "After hours", date: "2025-01-02", startTime: "01:00",
  venueName: "Club", city: "Tokyo", timezone: "Asia/Tokyo", sourceEventId: "provider-id",
};

test("groups saved local dates, deduplicates attended Nights, and filters kinds", () => {
  const entries = {
    a: { status: "attended", snapshot },
    b: { status: "interested", snapshot: { ...snapshot, title: "Interested", sourceEventId: "b" } },
    c: { status: "going", snapshot: { ...snapshot, title: "Going", sourceEventId: "c" } },
    missing: { status: "attended" },
  };
  const nights = [{ id: "n1", sourceEventId: "provider-id", date: "2025-01-02", eventName: "Night", venueName: "Club" }];
  const original = process.env.TZ;
  try {
    for (const tz of ["Pacific/Honolulu", "America/Toronto", "Asia/Tokyo"]) {
      process.env.TZ = tz;
      const items = calendar.calendarItems(entries, nights, new Date("2025-01-03T00:00:00Z"));
      assert.equal(items.length, 3);
      assert.ok(items.every((item) => item.date === "2025-01-02"));
      assert.deepEqual(new Set(items.map((item) => item.kind)), new Set(["going", "interested", "attended"]));
      assert.equal(calendar.filterCalendarItems(items, "attended")[0].nightId, "n1");
      assert.equal(calendar.filterCalendarItems(items, "going")[0].canLogNight, true);
      assert.equal(calendar.filterCalendarItems(items, "interested").length, 1);
      assert.equal(calendar.filterCalendarItems(items, "all").length, 3);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test("past Going prompts only for unlinked events in the event's own timezone", () => {
  const entries = {
    past: { status: "going", snapshot },
    linked: { status: "going", snapshot: { ...snapshot, sourceEventId: "linked" } },
    attended: { status: "attended", snapshot: { ...snapshot, sourceEventId: "other" } },
  };
  const nights = [{ id: "n", sourceEventId: "linked", date: "2025-01-02", eventName: "Night", venueName: "Club" }];
  const beforeMidnightInTokyo = calendar.calendarItems(entries, nights, new Date("2025-01-02T14:59:00Z"));
  const afterMidnightInTokyo = calendar.calendarItems(entries, nights, new Date("2025-01-02T15:01:00Z"));
  assert.equal(beforeMidnightInTokyo.find((item) => item.eventId === "past").canLogNight, true);
  assert.equal(afterMidnightInTokyo.find((item) => item.eventId === "past").canLogNight, true);
  assert.equal(afterMidnightInTokyo.find((item) => item.eventId === "linked").canLogNight, false);
  assert.equal(afterMidnightInTokyo.find((item) => item.eventId === "attended").canLogNight, false);
  assert.equal(calendar.calendarItems(entries, nights, new Date("2025-01-01T15:59:00Z")).find((item) => item.eventId === "past").canLogNight, false);
  assert.equal(calendar.calendarItems(entries, nights, new Date("2025-01-01T16:01:00Z")).find((item) => item.eventId === "past").canLogNight, true);
  const invalid = calendar.calendarItems({ bad: { status: "going", snapshot: { ...snapshot, timezone: "Invalid/Zone" } } }, [], new Date("2025-01-03T00:00:00Z"))[0];
  assert.equal(invalid.canLogNight, false);
  assert.equal(invalid.timezoneError, true);
});

test("month grids honor Sunday and Monday starts, leap years and year boundaries", () => {
  assert.equal(calendar.weekStartsOn(1, "en-US"), 0);
  assert.equal(calendar.weekStartsOn(2, "en-GB"), 1);
  assert.equal(calendar.weekStartsOn(null, "en-US"), 0);
  assert.equal(calendar.weekStartsOn(null, "en-GB"), 1);
  const sunday = calendar.monthGrid(2024, 8, 0);
  const monday = calendar.monthGrid(2024, 8, 1);
  assert.equal(sunday.indexOf("2024-09-01"), 0);
  assert.equal(monday.indexOf("2024-09-01"), 6);
  assert.equal(calendar.monthGrid(2024, 1, 1).filter(Boolean).length, 29);
  assert.equal(calendar.shiftMonth("2024-12-31", 1), "2025-01-01");
  assert.equal(calendar.shiftMonth("2024-01-31", -1), "2023-12-01");
});

test("legacy backfill is capped, uses three workers, retries failures, and skips samples", async () => {
  const entries = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`event-${String(i).padStart(2, "0")}`, { status: "attended" }]));
  entries["raveorb-local-sample-festival"] = { status: "going" };
  entries["raveorb-local-sample-night-of-1"] = { status: "going" };
  let concurrent = 0;
  let maxConcurrent = 0;
  let fail = true;
  const calls = [];
  const { backfillCalendarEvents } = load("services/calendarBackfill.ts", {
    "../lib/eventStatusStorage": { eventStatusStorage: {
      async listTracked() { return entries; },
      async backfillSnapshots(events) { for (const event of events) entries[event.id].snapshot = { ...snapshot, sourceEventId: event.id }; },
      async recordLatest() {},
    } },
    "../lib/sampleEvent": { SAMPLE_EVENT_ID_PREFIX: "raveorb-local-sample-night-of-" },
    "../lib/sampleFestival": { SAMPLE_FESTIVAL_ID: "raveorb-local-sample-festival" },
    "./eventsRepository": { eventsRepository: { async getEvent(id) {
      calls.push(id);
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setImmediate(resolve));
      concurrent--;
      if (id === "event-00" && fail) throw new Error("offline");
      return { id };
    } } },
  });
  const [first, shared] = await Promise.all([backfillCalendarEvents(), backfillCalendarEvents()]);
  assert.strictEqual(first, shared);
  assert.equal(calls.length, 50);
  assert.equal(maxConcurrent, 3);
  assert.deepEqual(first.failed, ["event-00"]);
  assert.equal(first.pending, 10);
  assert.ok(calls.every((id) => !id.startsWith("raveorb-local-sample")));
  fail = false;
  const second = await backfillCalendarEvents();
  assert.equal(second.failed.length, 0);
  assert.ok(calls.filter((id) => id === "event-00").length === 2);
  assert.equal(Object.keys(entries).filter((id) => id.startsWith("event-") && !entries[id].snapshot).length, 0);
});

test("legacy backfill stops after a connection failure rather than spamming offline requests", async () => {
  const entries = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`event-${i}`, { status: "going" }]));
  const calls = [];
  const { backfillCalendarEvents } = load("services/calendarBackfill.ts", {
    "../lib/eventStatusStorage": { eventStatusStorage: { async listTracked() { return entries; } } },
    "../lib/sampleEvent": { SAMPLE_EVENT_ID_PREFIX: "sample-" },
    "../lib/sampleFestival": { SAMPLE_FESTIVAL_ID: "festival" },
    "./eventsRepository": { eventsRepository: { async getEvent(id) {
      calls.push(id);
      throw new Error("The event service could not be reached. Check the API URL and connection.");
    } } },
  });
  const result = await backfillCalendarEvents();
  assert.equal(calls.length, 3);
  assert.equal(result.offline, true);
  assert.equal(result.pending, 7);
  assert.deepEqual(result.failed, calls);
});

test("routes use Calendar rather than a Venues tab", () => {
  const src = path.resolve(__dirname, "../src");
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (/\.[jt]sx?$/.test(entry.name)) assert.doesNotMatch(fs.readFileSync(filename, "utf8"), /\/\(tabs\)\/venues/);
    }
  }
  visit(src);
  const layout = fs.readFileSync(path.join(src, "app/(tabs)/_layout.tsx"), "utf8");
  assert.match(layout, /name="calendar" options=\{\{ title: "Calendar" \}\}/);
  assert.match(layout, /route\.name === "events"\s*\?\s*"compass"/);
  assert.match(layout, /route\.name === "calendar"\s*\?\s*"calendar"/);
  assert.equal(fs.existsSync(path.join(src, "app/(tabs)/venues.tsx")), false);
  assert.match(fs.readFileSync(path.join(src, "app/venues.tsx"), "utf8"), /VenuesScreen/);
});

function find(element, predicate) {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap((item) => find(item, predicate));
  return [...(predicate(element) ? [element] : []), ...find(element.props?.children, predicate)];
}

test("calendar renders labelled kinds and opens saved events or a prefilled Night", () => {
  const paths = [];
  const states = [
    "2025-01-02", "all",
    { event: { status: "going", snapshot } },
    [], false, "", "", 0,
  ];
  let stateIndex = 0;
  const { default: CalendarScreen } = load("screens/CalendarScreen.tsx", {
    react: { useCallback: (fn) => fn, useMemo: (fn) => fn(), useState: () => [states[stateIndex++], () => {}] },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-localization": { useCalendars: () => [{ firstWeekday: 2 }], useLocales: () => [{ languageTag: "en-GB" }] },
    "expo-router": { router: { push: (route) => paths.push(route) }, useFocusEffect() {} },
    "react-native": { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", StyleSheet: { create: (styles) => styles }, Text: "Text", View: "View" },
    "../components/EmptyState": { EmptyState: "EmptyState" },
    "../components/Screen": { Screen: "Screen" },
    "../lib/beacon": { nightPrefill: (event) => ({ sourceEventId: event.sourceEventId, date: event.date, eventName: event.title, artists: event.artists.join("|") }) },
    "../lib/calendarDate": dates,
    "../lib/eventStatusStorage": {}, "../lib/nightsStorage": {},
    "../lib/raveCalendar": calendar,
    "../services/calendarBackfill": {}, "../services/eventChangesService": {},
    "../theme/colors": { colors: {} },
    "../theme/spacing": { spacing: {} },
  });
  const tree = CalendarScreen();
  assert.ok(find(tree, (item) => item.type === "Text" && item.props.children === "Going").length >= 2);
  const open = find(tree, (item) => item.props?.accessibilityLabel === "Open After hours")[0];
  const log = find(tree, (item) => item.type === "Pressable" && item.props.children?.props?.children === "Went? Log this Night")[0];
  open.props.onPress();
  log.props.onPress();
  assert.deepEqual(paths, [
    { pathname: "/event/[id]", params: { id: "event" } },
    { pathname: "/night/new", params: { sourceEventId: "provider-id", date: "2025-01-02", eventName: "After hours", artists: "" } },
  ]);
});

test("calendar shows local items before backfill finishes and reports missing details after failure", async () => {
  const saved = {
    event: { status: "going", snapshot },
    missing: { status: "interested" },
  };
  let resolveBackfill;
  const backfill = new Promise((resolve) => { resolveBackfill = resolve; });
  let focus;
  let index = 0;
  const states = [];
  const react = {
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useState(initial) {
      const current = index++;
      if (!(current in states)) states[current] = typeof initial === "function" ? initial() : initial;
      return [states[current], (value) => { states[current] = typeof value === "function" ? value(states[current]) : value; }];
    },
  };
  const { default: CalendarScreen } = load("screens/CalendarScreen.tsx", {
    react,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-localization": { useCalendars: () => [{ firstWeekday: 1 }], useLocales: () => [{ languageTag: "en-US" }] },
    "expo-router": { router: { push() {} }, useFocusEffect: (fn) => { focus = fn; } },
    "react-native": { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", StyleSheet: { create: (styles) => styles }, Text: "Text", View: "View" },
    "../components/EmptyState": { EmptyState: "EmptyState" },
    "../components/Screen": { Screen: "Screen" },
    "../lib/beacon": { nightPrefill() {} },
    "../lib/calendarDate": dates,
    "../lib/eventStatusStorage": { eventStatusStorage: { async listTracked() { return saved; } } },
    "../lib/nightsStorage": { nightsStorage: { async list() { return []; } } },
    "../lib/raveCalendar": calendar,
    "../services/calendarBackfill": { backfillCalendarEvents: () => backfill },
    "../services/eventChangesService": { async refreshTrackedEvents() { throw new Error("offline"); } },
    "../theme/colors": { colors: {} },
    "../theme/spacing": { spacing: {} },
  });
  const render = () => { index = 0; return CalendarScreen(); };
  render();
  states[0] = "2025-01-02";
  const cleanup = focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(find(render(), (item) => item.props?.accessibilityLabel === "Open After hours").length, 1);
  assert.equal(states[6], "");
  resolveBackfill({ candidates: ["missing"], attempted: ["missing"], failed: ["missing"], pending: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(states[6], /details unavailable/);
  cleanup();
});
