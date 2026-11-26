const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

let stored = null;
const asyncStorage = {
  async getItem() { return stored; },
  async setItem(_key, value) { stored = value; },
};

function load(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name in mocks ? mocks[name] : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

const changes = load("src/lib/eventChanges.ts");
const { eventStatusStorage } = load("src/lib/eventStatusStorage.ts", {
  "@react-native-async-storage/async-storage": asyncStorage,
  "./eventChanges": changes,
});
const base = {
  id: "event-1", title: "Night", status: "scheduled", date: "2030-06-07", startTime: "23:00",
  venueName: "The Hall", city: "Montreal", timezone: "America/Toronto",
};

test.beforeEach(() => { stored = null; });

test("detects each material change and ignores case, whitespace and equivalent times", () => {
  const snapshot = changes.snapshotEvent(base);
  assert.deepEqual(changes.detectEventChanges(snapshot, { ...snapshot, venueName: " THE   HALL ", city: "montreal", startTime: "23:00:00" }), []);
  for (const [status, kind] of [["cancelled", "cancelled"], ["postponed", "postponed"], ["rescheduled", "rescheduled"], ["sold-out", "sold-out"]]) {
    assert.equal(changes.detectEventChanges(snapshot, { ...snapshot, status })[0].kind, kind);
  }
  assert.equal(changes.detectEventChanges({ ...snapshot, status: "sold-out" }, snapshot)[0].label, "Tickets available again");
  assert.equal(changes.detectEventChanges(snapshot, { ...snapshot, date: "2030-06-08", startTime: "00:30" })[0].kind, "rescheduled");
  assert.equal(changes.detectEventChanges(snapshot, { ...snapshot, venueName: "New Hall" })[0].kind, "venue");
  const originalTimezone = process.env.TZ;
  try {
    for (const tz of ["Pacific/Honolulu", "Asia/Tokyo"]) {
      process.env.TZ = tz;
      assert.equal(changes.detectEventChanges(snapshot, { ...snapshot, startTime: "23:01" })[0].kind, "rescheduled");
      assert.equal(changes.detectEventChanges(snapshot, { ...snapshot, startTime: "23:00:00" }).length, 0);
    }
  } finally { if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone; }
});

test("migrates legacy statuses without losing them and backfills observed snapshots", async () => {
  stored = JSON.stringify({ "event-1": "going", old: "interested", attended: "attended" });
  assert.deepEqual(await eventStatusStorage.list(), { "event-1": "going", old: "interested", attended: "attended" });
  await eventStatusStorage.backfillSnapshots([base]);
  const records = await eventStatusStorage.listTracked();
  assert.equal(records["event-1"].snapshot.date, base.date);
  assert.equal(records.old.snapshot, undefined);
  assert.equal(records.attended.status, "attended");
  assert.equal(JSON.parse(stored).version, 2);
});

test("backfill enriches attended snapshots without acknowledging schedule changes", async () => {
  stored = JSON.stringify({ version: 2, cursor: 0, entries: {
    legacy: { status: "attended", snapshot: changes.snapshotEvent({ ...base, id: "legacy" }) },
  } });
  const parsed = JSON.parse(stored);
  delete parsed.entries.legacy.snapshot.sourceEventId;
  stored = JSON.stringify(parsed);
  await eventStatusStorage.backfillSnapshots([{ ...base, id: "legacy", sourceEventId: "provider-id", artists: ["Artist"], date: "2030-07-01" }]);
  const { snapshot } = (await eventStatusStorage.listTracked()).legacy;
  assert.equal(snapshot.sourceEventId, "provider-id");
  assert.deepEqual(snapshot.artists, ["Artist"]);
  assert.equal(snapshot.date, "2030-06-07");
});

test("throttles refreshes, rotates the 25-event cap and excludes past events", async () => {
  for (let index = 0; index < 30; index++) {
    await eventStatusStorage.set(`event-${String(index).padStart(2, "0")}`, "going", { ...base, id: `event-${index}` });
  }
  await eventStatusStorage.set("past", "going", { ...base, date: "2030-06-06" });
  const now = new Date("2030-06-07T16:00:00Z");
  const first = await eventStatusStorage.reserveRefresh(now);
  assert.equal(first.length, 25);
  assert.equal(first.includes("past"), false);
  assert.deepEqual(await eventStatusStorage.reserveRefresh(new Date(now.getTime() + 6 * 3600000 - 1)), []);
  const second = await eventStatusStorage.reserveRefresh(new Date(now.getTime() + 6 * 3600000));
  assert.equal(second.length, 25);
  assert.ok(second.includes("event-29"));
});

test("refresh skips events already attempted by calendar backfill", async () => {
  await eventStatusStorage.set("first", "going", { ...base, id: "first" });
  await eventStatusStorage.set("second", "going", { ...base, id: "second" });
  assert.deepEqual(await eventStatusStorage.reserveRefresh(new Date("2030-06-07T16:00:00Z"), new Set(["first"])), ["second"]);
});

test("dismissing one change keeps unrelated changes pending", async () => {
  await eventStatusStorage.set("event-1", "going", base);
  await eventStatusStorage.recordLatest("event-1", { ...base, status: "cancelled", date: "2030-06-08", venueName: "New Hall" });
  await eventStatusStorage.dismiss("event-1", "rescheduled");
  const { snapshot, latest } = (await eventStatusStorage.listTracked())["event-1"];
  assert.deepEqual(changes.detectEventChanges(snapshot, latest).map((change) => change.kind), ["cancelled", "venue"]);
});

test("past-date entries do not appear in the tracked changes list", async () => {
  await eventStatusStorage.set("past", "going", { ...base, date: "2030-06-06" });
  await eventStatusStorage.recordLatest("past", { ...base, date: "2030-06-06", status: "cancelled" });
  await eventStatusStorage.set("today", "interested", base);
  await eventStatusStorage.recordLatest("today", { ...base, status: "cancelled" });
  const service = load("src/services/eventChangesService.ts", {
    "../lib/eventChanges": changes,
    "../lib/eventStatusStorage": { eventStatusStorage },
    "../lib/calendarEventDetails": { buildCalendarEventDetails: () => null },
    "../lib/calendarLinkStorage": { calendarLinkStorage: {} },
    "./calendarService": { calendarService: {} },
    "./eventsRepository": { eventsRepository: {} },
  });
  const list = await service.listTrackedEventChanges(new Date("2030-06-07T16:00:00Z"));
  assert.deepEqual(list.map((item) => item.id), ["today"]);
  assert.equal(list[0].changes[0].kind, "cancelled");
});

test("update calendar action reschedules or cancels the linked calendar event", async () => {
  const calls = [];
  const links = { "event-1": "cal-1" };
  const details = { title: "Night", startDate: new Date(), endDate: new Date() };
  const service = load("src/services/eventChangesService.ts", {
    "../lib/eventChanges": changes,
    "../lib/eventStatusStorage": { eventStatusStorage },
    "../lib/calendarEventDetails": { buildCalendarEventDetails: () => details },
    "../lib/calendarLinkStorage": { calendarLinkStorage: {
      async get(id) { return links[id] ?? null; },
      async remove(id) { delete links[id]; },
    } },
    "./calendarService": { calendarService: {
      async ensurePermission() { return true; },
      async eventExists(id) { return id === "cal-1"; },
      async markCancelled(id) { calls.push(["cancel", id]); },
      async rescheduleEvent(id, next) { calls.push(["reschedule", id, next]); },
    } },
    "./eventsRepository": { eventsRepository: { async getEvent() { return base; } } },
  });

  assert.equal(service.canUpdateCalendar("rescheduled"), true);
  assert.equal(service.canUpdateCalendar("cancelled"), true);
  assert.equal(service.canUpdateCalendar("venue"), false);

  await service.updateCalendarForChange("event-1", "cancelled");
  await service.updateCalendarForChange("event-1", "rescheduled");
  assert.deepEqual(calls, [["cancel", "cal-1"], ["reschedule", "cal-1", details]]);

  await assert.rejects(service.updateCalendarForChange("event-2", "cancelled"), /not in your calendar/);

  links["event-1"] = "cal-gone";
  await assert.rejects(service.updateCalendarForChange("event-1", "cancelled"), /no longer in your calendar/);
  assert.equal(links["event-1"], undefined); // link cleared so the event can be re-added
});
