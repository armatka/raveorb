const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/clockTime.ts");
const source = fs.readFileSync(filename, "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = new Module(filename, module);
loaded._compile(output, filename);
const { parseClockTime, formatClockTime, displayClockTime } = loaded.exports;

test("canonical times round trip including overnight events", () => {
  for (const value of ["00:00", "03:00", "12:00", "22:30", "23:59"]) {
    assert.equal(formatClockTime(parseClockTime(value)), value);
  }
  assert.equal(formatClockTime(parseClockTime("22:00")), "22:00");
  assert.equal(formatClockTime(parseClockTime("03:00")), "03:00");
});

test("invalid times are not normalized into another value", () => {
  for (const value of ["", "24:00", "12:60", "2:30", "22:30:00", "10:30 PM"]) {
    assert.equal(parseClockTime(value), null);
    assert.equal(displayClockTime(value), value);
  }
});

test("display follows the requested locale", () => {
  assert.match(displayClockTime("22:30", "en-US"), /10:30\s*PM/i);
  assert.equal(displayClockTime("22:30", "en-GB"), "22:30");
});