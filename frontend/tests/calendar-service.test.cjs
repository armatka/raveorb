const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadService({ platform, expoGo, calendar, storage }) {
  const filename = path.resolve(__dirname, "../src/services/calendarService.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => {
    if (name === "expo") return { isRunningInExpoGo: () => expoGo };
    if (name === "react-native") return { Platform: { OS: platform } };
    if (name === "expo-calendar") {
      if (!calendar) throw new Error("Cannot find native module");
      return calendar;
    }
    if (name === "../lib/calendarEventDetails") return { cancelledCalendarTitle: (title) => `CANCELLED: ${title}` };
    if (name === "../lib/calendarLinkStorage") return { calendarLinkStorage: storage };
    return require(name);
  };
  loaded._compile(output, filename);
  return loaded.exports.calendarService;
}

for (const environment of [{ platform: "ios", expoGo: true }, { platform: "web", expoGo: false }]) {
  test(`calendar service is safe without the native module on ${environment.platform}${environment.expoGo ? " Expo Go" : ""}`, async () => {
    let storageReads = 0;
    const service = loadService({
      ...environment,
      storage: { async get() { storageReads += 1; return "calendar-id"; } },
    });

    assert.equal(service.isAvailable(), false);
    assert.equal(await service.hasPermission(), false);
    assert.equal(await service.ensurePermission(), false);
    assert.equal(await service.addEvent({}), null);
    assert.equal(await service.eventExists("calendar-id"), false);
    assert.equal(await service.rescheduleEvent("calendar-id", {}), false);
    assert.equal(await service.markCancelled("calendar-id"), false);
    assert.equal(await service.resolveLinkedEvent("event-id"), null);
    assert.equal(storageReads, 0);
  });
}

test("full app lazily loads the calendar and performs updates", async () => {
  const updates = [];
  const event = { id: "calendar-id", title: "Night", async update(value) { updates.push(value); } };
  const service = loadService({
    platform: "ios",
    expoGo: false,
    storage: { async get() { return "calendar-id"; } },
    calendar: {
      async getCalendarPermissions() { return { granted: true }; },
      getDefaultCalendarSync() { return { async createEvent() { return event; } }; },
      ExpoCalendarEvent: { async get() { return event; } },
    },
  });
  const details = {
    title: "Night", location: "Venue", notes: "Notes", startDate: new Date(0),
    endDate: new Date(1000), timeZone: "UTC", alarmOffsetMinutes: -120,
  };
  assert.equal(await service.ensurePermission(), true);
  assert.equal(await service.addEvent(details), "calendar-id");
  assert.equal(await service.resolveLinkedEvent("event-id"), "calendar-id");
  assert.equal(await service.rescheduleEvent("calendar-id", details), true);
  assert.equal(await service.markCancelled("calendar-id"), true);
  assert.deepEqual(updates, [
    { startDate: details.startDate, endDate: details.endDate, timeZone: "UTC" },
    { title: "CANCELLED: Night" },
  ]);
});

test("native module loading errors remain visible in the full app", async () => {
  const service = loadService({ platform: "ios", expoGo: false, storage: {} });
  await assert.rejects(service.hasPermission(), /Cannot find native module/);
});
