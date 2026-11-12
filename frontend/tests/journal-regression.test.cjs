const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

let stored = null;
let writes = 0;
let storageFails = false;
const deletedPhotos = [];

const asyncStorage = {
  async getItem() {
    if (storageFails) throw new Error("Storage unavailable");
    return stored;
  },
  async setItem(_key, value) {
    if (storageFails) throw new Error("Storage unavailable");
    writes += 1;
    stored = value;
  },
};

class Directory {
  constructor() { this.uri = "file:///documents/night-photos"; }
  create() {}
}
class File {
  constructor(uri) { this.uri = uri; }
  delete() { deletedPhotos.push(this.uri); }
}

function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => {
    if (name === "@react-native-async-storage/async-storage") return asyncStorage;
    if (name === "expo-file-system") return { Directory, File, Paths: { document: "file:///documents" } };
    if (name === "react-native") return { Platform: { OS: "ios" } };
    return require(name);
  };
  loaded._compile(output, filename);
  return loaded.exports;
}

const { nightsStorage } = loadTypeScript("src/lib/nightsStorage.ts");
const { calculateNightStats } = loadTypeScript("src/lib/nightStats.ts");
const { eventStatusStorage } = loadTypeScript("src/lib/eventStatusStorage.ts");

function night(overrides = {}) {
  return {
    id: "night-1", date: "2026-03-20", eventName: "Example", venueName: "Venue", city: "City",
    artistsSeen: ["Artist"], friends: ["Friend"], rating: 4, cost: 25, currency: "CAD",
    notes: "Notes", favoriteMoment: "Moment", photos: ["file:///documents/night-photos/one.jpg"],
    createdAt: "2026-03-20T00:00:00.000Z", updatedAt: "2026-03-20T00:00:00.000Z", ...overrides,
  };
}

test.beforeEach(() => { stored = null; writes = 0; storageFails = false; deletedPhotos.length = 0; });

test("legacy records migrate without losing optional fields or photos", async () => {
  const legacy = night({ sourceEventId: "event-1" });
  delete legacy.currency;
  stored = JSON.stringify([legacy, night({ id: "night-2", currency: "EUR" })]);
  const result = await nightsStorage.list();
  assert.equal(result.find((item) => item.id === "night-1").currency, "USD");
  assert.equal(result.find((item) => item.id === "night-1").sourceEventId, "event-1");
  assert.deepEqual(result.find((item) => item.id === "night-1").photos, legacy.photos);
  assert.equal(result.find((item) => item.id === "night-2").currency, "EUR");
  assert.equal(writes, 1);
});

test("malformed or unsupported data is never overwritten", async () => {
  for (const original of ["{", JSON.stringify([night({ currency: "GBP" }), night({ currency: undefined })])]) {
    stored = original;
    await assert.rejects(nightsStorage.list());
    await assert.rejects(nightsStorage.create(night()));
    assert.equal(stored, original);
    assert.equal(writes, 0);
  }
});

test("edit preserves creation time, linkage and retained photos", async () => {
  const original = night({ sourceEventId: "event-1", photos: ["file:///documents/night-photos/one.jpg", "file:///documents/night-photos/two.jpg"] });
  stored = JSON.stringify([original]);
  const updated = await nightsStorage.update(original.id, { ...original, eventName: "Edited", photos: [original.photos[1]] });
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.sourceEventId, "event-1");
  assert.equal((await nightsStorage.get(original.id)).eventName, "Edited");
  assert.deepEqual(deletedPhotos, [original.photos[0]]);
});

test("delete removes managed photos and leaves external photos alone", async () => {
  const original = night({ photos: ["file:///documents/night-photos/one.jpg", "file:///other/photo.jpg"] });
  stored = JSON.stringify([original]);
  await nightsStorage.remove(original.id);
  assert.equal(await nightsStorage.get(original.id), null);
  assert.deepEqual(deletedPhotos, [original.photos[0]]);
});

test("storage errors propagate to callers", async () => {
  storageFails = true;
  await assert.rejects(nightsStorage.list(), /Storage unavailable/);
  await assert.rejects(nightsStorage.create(night()), /Storage unavailable/);
});

test("mixed currencies are aggregated separately", () => {
  const stats = calculateNightStats([night({ cost: 10 }), night({ id: "2", cost: 20, currency: "USD" }), night({ id: "3", cost: 5 })], null);
  assert.deepEqual(stats.spending.map(({ currency, total }) => ({ currency, total })), [{ currency: "CAD", total: 15 }, { currency: "USD", total: 20 }]);
});

test("event status changes preserve other statuses", async () => {
  stored = JSON.stringify({ first: "going", second: "attended" });
  await eventStatusStorage.set("first", "interested");
  assert.deepEqual(await eventStatusStorage.list(), { first: "interested", second: "attended" });
});

test("invalid event statuses cannot be silently overwritten", async () => {
  stored = JSON.stringify({ first: "going", second: "unknown" });
  const original = stored;
  await assert.rejects(eventStatusStorage.set("first", "attended"));
  assert.equal(stored, original);
  assert.equal(writes, 0);
});