const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

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

const {
  buildCalendarEventDetails,
  cancelledCalendarTitle,
  zonedDateTimeToUtc,
  CALENDAR_ALARM_OFFSET_MINUTES,
  CALENDAR_NOTES_TAGLINE,
} = load("src/lib/calendarEventDetails.ts");

const baseEvent = {
  id: "evt-1", title: "Warehouse Rave", type: "rave", venueId: "v1",
  venueName: "The Warehouse", address: "123 Queen St W", city: "Toronto", countryCode: "CA",
  date: "2030-06-07", startTime: "23:00", endTime: "", timezone: "America/Toronto",
  artists: [], genres: [], description: "", source: "ticketmaster",
  ticketUrl: "https://tickets.example/warehouse",
};

test("converts start time using the event's timezone, not the device's", () => {
  const summer = buildCalendarEventDetails(baseEvent);
  assert.equal(summer.startDate.toISOString(), "2030-06-08T03:00:00.000Z"); // EDT, UTC-4

  const winter = buildCalendarEventDetails({ ...baseEvent, date: "2030-01-18" });
  assert.equal(winter.startDate.toISOString(), "2030-01-19T04:00:00.000Z"); // EST, UTC-5
  assert.equal(winter.timeZone, "America/Toronto");
});

test("uses the provided end time, rolling past midnight when it precedes the start", () => {
  const sameDay = buildCalendarEventDetails({ ...baseEvent, startTime: "18:00", endTime: "23:30" });
  assert.equal(sameDay.endDate.toISOString(), "2030-06-08T03:30:00.000Z");

  const overnight = buildCalendarEventDetails({ ...baseEvent, endTime: "04:00" });
  assert.equal(overnight.startDate.toISOString(), "2030-06-08T03:00:00.000Z");
  assert.equal(overnight.endDate.toISOString(), "2030-06-08T08:00:00.000Z"); // next day 04:00 EDT
});

test("defaults the end to start plus five hours when no end time is set", () => {
  for (const endTime of ["", "   ", undefined]) {
    const details = buildCalendarEventDetails({ ...baseEvent, endTime });
    assert.equal(details.endDate.getTime() - details.startDate.getTime(), 5 * 60 * 60 * 1000);
  }
});

test("accepts times with seconds and rejects malformed schedules", () => {
  const withSeconds = buildCalendarEventDetails({ ...baseEvent, startTime: "23:00:00" });
  assert.equal(withSeconds.startDate.toISOString(), "2030-06-08T03:00:00.000Z");

  assert.equal(buildCalendarEventDetails({ ...baseEvent, date: "June 7" }), null);
  assert.equal(buildCalendarEventDetails({ ...baseEvent, startTime: "late" }), null);
});

test("falls back to device time and omits timeZone for unknown timezones", () => {
  const details = buildCalendarEventDetails({ ...baseEvent, timezone: "Not/AZone" });
  assert.ok(details);
  assert.equal(details.timeZone, undefined);
  assert.equal(details.startDate.getTime(), new Date(2030, 5, 7, 23, 0, 0).getTime());
});

test("builds location from venue name and address with a city fallback", () => {
  assert.equal(buildCalendarEventDetails(baseEvent).location, "The Warehouse, 123 Queen St W");
  assert.equal(buildCalendarEventDetails({ ...baseEvent, address: undefined }).location, "The Warehouse");
  assert.equal(buildCalendarEventDetails({ ...baseEvent, venueName: "", address: " " }).location, "Toronto, CA");
});

test("notes contain the ticket or event URL and the RaveOrb tagline", () => {
  assert.equal(buildCalendarEventDetails(baseEvent).notes, `https://tickets.example/warehouse\n\n${CALENDAR_NOTES_TAGLINE}`);
  const eventUrlOnly = buildCalendarEventDetails({ ...baseEvent, ticketUrl: undefined, eventUrl: "https://events.example/w" });
  assert.equal(eventUrlOnly.notes, `https://events.example/w\n\n${CALENDAR_NOTES_TAGLINE}`);
  const noUrl = buildCalendarEventDetails({ ...baseEvent, ticketUrl: " ", eventUrl: undefined });
  assert.equal(noUrl.notes, CALENDAR_NOTES_TAGLINE);
});

test("sets a single alarm two hours before the start", () => {
  assert.equal(CALENDAR_ALARM_OFFSET_MINUTES, -120);
  assert.equal(buildCalendarEventDetails(baseEvent).alarmOffsetMinutes, -120);
});

test("zonedDateTimeToUtc resolves wall times across DST offsets", () => {
  assert.equal(zonedDateTimeToUtc("2030-07-01", "12:00", "Europe/Berlin").toISOString(), "2030-07-01T10:00:00.000Z");
  assert.equal(zonedDateTimeToUtc("2030-12-01", "12:00", "Europe/Berlin").toISOString(), "2030-12-01T11:00:00.000Z");
  assert.equal(zonedDateTimeToUtc("2030-07-01", "12:00", "UTC").toISOString(), "2030-07-01T12:00:00.000Z");
});

test("cancelled title prefix is applied once", () => {
  assert.equal(cancelledCalendarTitle("Warehouse Rave"), "CANCELLED: Warehouse Rave");
  assert.equal(cancelledCalendarTitle("CANCELLED: Warehouse Rave"), "CANCELLED: Warehouse Rave");
});
