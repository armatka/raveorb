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

const { calendarLinkStorage } = load("src/lib/calendarLinkStorage.ts", {
  "@react-native-async-storage/async-storage": asyncStorage,
});

test.beforeEach(() => { stored = null; });

test("returns no link for unknown events", async () => {
  assert.equal(await calendarLinkStorage.get("evt-1"), null);
  assert.deepEqual(await calendarLinkStorage.list(), {});
});

test("stores and lists calendar event ids per RaveOrb event", async () => {
  await calendarLinkStorage.set("evt-1", "cal-100");
  await calendarLinkStorage.set("evt-2", "cal-200");
  assert.equal(await calendarLinkStorage.get("evt-1"), "cal-100");
  assert.deepEqual(await calendarLinkStorage.list(), { "evt-1": "cal-100", "evt-2": "cal-200" });

  await calendarLinkStorage.set("evt-1", "cal-101");
  assert.equal(await calendarLinkStorage.get("evt-1"), "cal-101");
});

test("removing a link allows the event to be added again", async () => {
  await calendarLinkStorage.set("evt-1", "cal-100");
  await calendarLinkStorage.remove("evt-1");
  assert.equal(await calendarLinkStorage.get("evt-1"), null);
  await calendarLinkStorage.remove("evt-unknown"); // no-op, does not throw
  assert.deepEqual(await calendarLinkStorage.list(), {});
});

test("rejects corrupt or unsupported stored data", async () => {
  stored = "not json";
  await assert.rejects(calendarLinkStorage.get("evt-1"), /could not be read/);
  stored = JSON.stringify(["cal-100"]);
  await assert.rejects(calendarLinkStorage.list(), /unsupported records/);
  stored = JSON.stringify({ "evt-1": 42 });
  await assert.rejects(calendarLinkStorage.set("evt-2", "cal-200"), /unsupported records/);
});

test("queued writes do not lose concurrent updates", async () => {
  await Promise.all([
    calendarLinkStorage.set("evt-1", "cal-100"),
    calendarLinkStorage.set("evt-2", "cal-200"),
    calendarLinkStorage.remove("evt-1"),
  ]);
  assert.deepEqual(await calendarLinkStorage.list(), { "evt-2": "cal-200" });
});
