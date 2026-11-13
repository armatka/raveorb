const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadLocationsApi(requestEventsApi) {
  const filename = path.resolve(__dirname, "../src/services/locationsApi.ts");
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name === "./eventsApi"
    ? { hasEventsApi: () => true, requestEventsApi } : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

const city = {
  id: "6094817", label: "Ottawa, Ontario, Canada", city: "Ottawa", region: "Ontario",
  country: "Canada", countryCode: "CA", latitude: 45.41117, longitude: -75.69812,
  timezone: "America/Toronto", population: 812129,
};

test("maps disambiguated city results with coordinates and timezone for radius searches", async () => {
  let requestPath;
  const cities = [city, {
    ...city, id: "4905006", label: "Ottawa, Illinois, United States", region: "Illinois",
    country: "United States", countryCode: "US", latitude: 41.34559, longitude: -88.84258,
    timezone: "America/Chicago",
  }];
  const { searchLocations } = loadLocationsApi(async (path) => {
    requestPath = path;
    return { payload: cities.map((item) => ({ ...item, unexpectedProviderField: "ignored" })) };
  });
  assert.deepEqual(await searchLocations(" Ottawa & nearby "), cities);
  assert.equal(requestPath, "/api/locations/search?q=Ottawa+%26+nearby");
});

test("minimum and maximum lengths are enforced before making a city request", async () => {
  let requests = 0;
  const { searchLocations, isLocationSearchQuery } = loadLocationsApi(async () => {
    requests += 1;
    return { payload: [] };
  });
  for (const query of ["", " ", " a ", "a".repeat(81)]) {
    assert.equal(isLocationSearchQuery(query), false);
    await assert.rejects(searchLocations(query), /between 2 and 80/);
  }
  assert.equal(requests, 0);
  assert.equal(isLocationSearchQuery(" ab "), true);
  assert.equal(isLocationSearchQuery("a".repeat(80)), true);
  assert.deepEqual(await searchLocations("ab"), []);
  assert.equal(requests, 1);
});

test("invalid results and service errors are surfaced instead of becoming empty success", async () => {
  for (const payload of [{}, [{ ...city, latitude: undefined }], [{ ...city, longitude: 181 }], [{ ...city, countryCode: "" }]]) {
    const { searchLocations } = loadLocationsApi(async () => ({ payload }));
    await assert.rejects(searchLocations("Ottawa"), /invalid response/);
  }
  const { searchLocations } = loadLocationsApi(async () => { throw new Error("City search is unavailable"); });
  await assert.rejects(searchLocations("Ottawa"), /unavailable/);
});
