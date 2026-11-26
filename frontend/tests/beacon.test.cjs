const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name in mocks ? mocks[name] : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

const calendar = load("src/lib/calendarEventDetails.ts");
const overrides = load("src/lib/beaconDevOverrides.ts");
const { isBeaconWindow, isAfterEvent, buildPlanMessage, nightPrefill } = load("src/lib/beacon.ts", {
  "./calendarEventDetails": calendar, "./beaconDevOverrides": overrides,
});
const event = {
  id: "1", title: "After Hours", venueName: "Warehouse", address: "123 Main St",
  city: "Toronto", date: "2030-06-07", startTime: "23:00", endTime: "04:00",
  timezone: "America/Toronto", artists: ["Alpha", "Beta"],
};

test("development overrides are independent and are ignored in production", () => {
  const previous = global.__DEV__;
  const early = new Date("2030-06-07T12:00:00Z");
  try {
    global.__DEV__ = true;
    assert.equal(isBeaconWindow(event, early), false);
    assert.equal(isAfterEvent(event, early), false);
    overrides.setBeaconDevOverride("forceWindow", true);
    assert.equal(isBeaconWindow(event, early), true);
    assert.equal(isAfterEvent(event, early), false);
    overrides.setBeaconDevOverride("forceAfterEvent", true);
    assert.equal(isAfterEvent(event, early), true);
    global.__DEV__ = false;
    assert.equal(isBeaconWindow(event, early), false);
    assert.equal(isAfterEvent(event, early), false);
    assert.deepEqual(overrides.getBeaconDevOverrides(), { forceWindow: false, forceAfterEvent: false });
    overrides.setBeaconDevOverride("forceWindow", false);
    global.__DEV__ = true;
    assert.equal(isBeaconWindow(event, early), true);
    overrides.setBeaconDevOverride("forceWindow", false);
    overrides.setBeaconDevOverride("forceAfterEvent", false);
    assert.equal(isBeaconWindow(event, early), false);
    assert.equal(isAfterEvent(event, early), false);
  } finally {
    global.__DEV__ = true;
    overrides.setBeaconDevOverride("forceWindow", false);
    overrides.setBeaconDevOverride("forceAfterEvent", false);
    if (previous === undefined) delete global.__DEV__;
    else global.__DEV__ = previous;
  }
});

test("override changes notify subscribed screens and stop after unsubscribe", () => {
  const previous = global.__DEV__;
  let notifications = 0;
  let unsubscribe;
  const store = load("src/lib/beaconDevOverrides.ts", {
    react: { useSyncExternalStore(subscribe, getSnapshot) {
      unsubscribe = subscribe(() => { notifications++; });
      return getSnapshot();
    } },
  });
  try {
    global.__DEV__ = true;
    assert.deepEqual(store.useBeaconDevOverrides(), { forceWindow: false, forceAfterEvent: false });
    store.setBeaconDevOverride("forceWindow", true);
    store.setBeaconDevOverride("forceWindow", true);
    assert.equal(notifications, 1);
    unsubscribe();
    store.setBeaconDevOverride("forceAfterEvent", true);
    assert.equal(notifications, 1);
  } finally {
    if (previous === undefined) delete global.__DEV__;
    else global.__DEV__ = previous;
  }
});

test("window uses the event timezone and inclusive six-hour/twelve-hour boundaries", () => {
  for (const [instant, expected] of [
    ["2030-06-07T20:59:59.999Z", false],
    ["2030-06-07T21:00:00.000Z", true],
    ["2030-06-08T03:00:00.000Z", true],
    ["2030-06-08T15:00:00.000Z", true],
    ["2030-06-08T15:00:00.001Z", false],
  ]) assert.equal(isBeaconWindow(event, new Date(instant)), expected, instant);
  assert.equal(isBeaconWindow({ ...event, date: "2030-01-18" }, new Date("2030-01-19T04:00:00Z")), true);
});

test("after-midnight start and end, DST, and invalid schedules are handled", () => {
  const afterMidnight = { ...event, date: "2030-06-08", startTime: "01:00", endTime: "04:00" };
  assert.equal(isBeaconWindow(afterMidnight, new Date("2030-06-08T00:00:00Z")), true);
  assert.equal(isAfterEvent(event, new Date("2030-06-08T07:59:59Z")), false);
  assert.equal(isAfterEvent(event, new Date("2030-06-08T08:00:00Z")), true);
  assert.equal(isAfterEvent({ ...event, endTime: "" }, new Date("2030-06-08T08:00:00Z")), true);
  assert.equal(isBeaconWindow({ ...event, timezone: "Unknown/Zone" }), false);
  assert.equal(isBeaconWindow({ ...event, date: "2030-02-30" }), false);
  assert.equal(isBeaconWindow({ ...event, startTime: "25:00" }), false);
  assert.equal(isBeaconWindow({ ...event, date: "2030-03-10", startTime: "02:30" }), false);
  const repeatedHour = { ...event, date: "2030-11-03", startTime: "01:30", dateTime: "2030-11-03T06:30:00Z" };
  assert.equal(isBeaconWindow(repeatedHour, new Date("2030-11-02T23:59:59Z")), false);
  assert.equal(isBeaconWindow(repeatedHour, new Date("2030-11-03T00:30:00Z")), true);
});

test("share message includes the plan and location only when explicitly supplied", () => {
  const message = buildPlanMessage(event, " 3:00 AM ");
  assert.equal(message, "Event: After Hours\nVenue: Warehouse\nAddress: 123 Main St, Toronto\nI'll text you when I'm home by 3:00 AM.");
  assert.equal(buildPlanMessage(event, "3 AM", { latitude: 43.1, longitude: -79.2 }),
    `${message.replace("3:00 AM", "3 AM")}\nMy current location: https://www.google.com/maps/search/?api=1&query=43.1%2C-79.2`);
});

test("journal prefill uses edited artists or falls back to lineup", () => {
  assert.deepEqual(nightPrefill(event, [{ artist: "  DJ One ", time: "1 AM" }, { artist: "", time: "" }]), {
    sourceEventId: "1", eventName: "After Hours", venueName: "Warehouse",
    city: "Toronto", date: "2030-06-07", artists: "DJ One",
  });
  assert.equal(nightPrefill(event, []).artists, "Alpha|Beta");
  assert.equal(nightPrefill({ ...event, sourceEventId: "source" }, []).sourceEventId, "source");
});

test("set times and meeting spots round trip independently per event and writes stay ordered", async () => {
  const data = new Map();
  const storage = {
    async getItem(key) { return data.get(key) ?? null; },
    async setItem(key, value) { await new Promise((resolve) => setTimeout(resolve, 2)); data.set(key, value); },
  };
  const { beaconStorage } = load("src/lib/beaconStorage.ts", { "@react-native-async-storage/async-storage": { default: storage, __esModule: true } });
  assert.equal(await beaconStorage.get("1"), null);
  const first = { sets: [{ artist: "Alpha", time: "23:00" }], meetingSpot: "Left of the bar" };
  const second = { sets: [{ artist: "Beta", time: "01:00" }], meetingSpot: "By the door" };
  data.set("raveorb.night-of.v1.legacy", JSON.stringify(first));
  assert.deepEqual(await beaconStorage.get("legacy"), first);
  await beaconStorage.set("legacy", second);
  assert.deepEqual(JSON.parse(data.get("raveorb.night-of.v1.legacy")), second);
  await Promise.all([beaconStorage.set("1", first), beaconStorage.set("1", second), beaconStorage.set("2", first)]);
  assert.deepEqual(await beaconStorage.get("1"), second);
  assert.deepEqual(await beaconStorage.get("2"), first);
  data.set("raveorb.night-of.v1.bad", '{"sets":false}');
  await assert.rejects(beaconStorage.get("bad"), /unsupported/);
});