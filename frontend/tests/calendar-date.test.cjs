const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/calendarDate.ts");
const source = fs.readFileSync(filename, "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = new Module(filename, module);
loaded._compile(output, filename);
const { parseCalendarDate, formatCalendarDate } = loaded.exports;

test("calendar dates round-trip as local dates", () => {
  for (const value of ["2026-11-07", "2024-02-29", "2000-01-01"]) {
    assert.equal(formatCalendarDate(parseCalendarDate(value)), value);
  }
});

test("invalid dates are rejected", () => {
  for (const value of ["2026-02-29", "2026-13-01", "2026-11-31", "", "2026-1-1"]) {
    assert.equal(parseCalendarDate(value), null);
  }
});