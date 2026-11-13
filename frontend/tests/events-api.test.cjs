const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(output, filename);
  return loaded.exports;
}

const { serializeEventsQuery } = loadTypeScript("src/services/eventsApi.ts");

test("serializes electronic-only discovery pagination options", () => {
  const params = new URLSearchParams(serializeEventsQuery({ electronicOnly: true, size: 50 }));
  assert.equal(params.get("electronicOnly"), "true");
  assert.equal(params.get("size"), "50");
});

test("omits electronicOnly for general event searches", () => {
  const params = new URLSearchParams(serializeEventsQuery({ keyword: "any event", size: 20 }));
  assert.equal(params.has("electronicOnly"), false);
});
