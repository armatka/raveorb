const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function renderScreen({ permission = true, focused = true } = {}) {
  const filename = path.resolve(__dirname, "../src/screens/BeaconScreen.tsx");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const event = { id: "1", title: "Night", venueName: "Venue", city: "Toronto", address: "123 Main", artists: ["Alpha"] };
  const details = { sets: [{ artist: "Alpha", time: "1 AM" }], meetingSpot: "Bar" };
  const states = [event, details, false, false, false, "", 0, "3 AM", false, new Date()];
  const shares = [];
  const alerts = [];
  const routes = [];
  let permissions = 0;
  let locations = 0;
  let stateIndex = 0;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => {
    if (name === "react") return { useCallback: (fn) => fn, useRef: (value) => ({ current: value }), useState: () => [states[stateIndex++], () => {}] };
    if (name === "expo-keep-awake") return { useKeepAwake() {} };
    if (name === "expo-location") return {
      Accuracy: { Balanced: 3 },
      async requestForegroundPermissionsAsync() { permissions++; return { granted: permission }; },
      async getCurrentPositionAsync() { locations++; return { coords: { latitude: 1, longitude: 2 } }; },
    };
    if (name === "expo-router") return {
      useFocusEffect() {}, useIsFocused: () => focused, useLocalSearchParams: () => ({ id: "1" }), router: { push: (route) => routes.push(route) },
    };
    if (name === "react-native") return {
      ActivityIndicator: "ActivityIndicator", Linking: {}, Platform: { OS: "ios" },
      Pressable: "Pressable", Share: { async share(message) { shares.push(message); } },
      StyleSheet: { create: (styles) => styles }, Text: "Text", TextInput: "TextInput", View: "View",
    };
    if (name === "../components/Screen") return { Screen: "Screen" };
    if (name === "../lib/eventFormatting") return { formatEventSchedule: () => "time" };
    if (name === "../lib/beacon") return {
      buildPlanMessage: (_event, homeBy, location) => JSON.stringify({ homeBy, location }),
      isAfterEvent: () => true,
      nightPrefill: (_event, sets) => ({ artists: sets[0].artist }),
    };
    if (name === "../lib/beaconDevOverrides") return { useBeaconDevOverrides() {} };
    if (name === "../lib/showAlert") return { showAlert: (title) => alerts.push(title) };
    if (name.startsWith("../lib/") || name.startsWith("../services/")) return {};
    return require(name);
  };
  loaded._compile(output, filename);
  return { tree: loaded.exports.default(), shares, alerts, routes, counts: () => ({ permissions, locations }) };
}

function find(element, predicate) {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap((item) => find(item, predicate));
  return [...(predicate(element) ? [element] : []), ...find(element.props?.children, predicate)];
}

function button(screen, title) {
  const matches = find(screen.tree, (element) => element.props?.title === title);
  assert.equal(matches.length, 1, title);
  return matches[0].props.onPress;
}

test("sharing is user initiated and location is requested only for the location option", async () => {
  const screen = renderScreen();
  assert.deepEqual(screen.counts(), { permissions: 0, locations: 0 });
  button(screen, "Share my plan")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(screen.shares[0].message, '{"homeBy":"3 AM"}');
  assert.deepEqual(screen.counts(), { permissions: 0, locations: 0 });
  button(screen, "Share plan with current location")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(screen.shares[1].message, '{"homeBy":"3 AM","location":{"latitude":1,"longitude":2}}');
  assert.deepEqual(screen.counts(), { permissions: 1, locations: 1 });
  button(screen, "I'm home")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(screen.shares[2].message, "Home safe 👍");
});

test("denied location does not fetch or share, and logging uses the current set list", async () => {
  const screen = renderScreen({ permission: false });
  button(screen, "Share plan with current location")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(screen.counts(), { permissions: 1, locations: 0 });
  assert.equal(screen.shares.length, 0);
  assert.deepEqual(screen.alerts, ["Location permission needed"]);
  button(screen, "Log this Night")();
  assert.deepEqual(screen.routes, [{ pathname: "/night/new", params: { artists: "Alpha" } }]);
});

test("keep-awake owner exists only while the screen is focused", () => {
  const awake = (element) => typeof element.type === "function" && element.type.name === "Awake";
  assert.equal(find(renderScreen().tree, awake).length, 1);
  assert.equal(find(renderScreen({ focused: false }).tree, awake).length, 0);
});

test("legacy event links redirect to the Beacon route with the same id", () => {
  const filename = path.resolve(__dirname, "../src/app/night-of/[id].tsx");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name === "expo-router"
    ? { Redirect: "Redirect", useLocalSearchParams: () => ({ id: "event-1" }) }
    : require(name);
  loaded._compile(output, filename);
  assert.deepEqual(loaded.exports.default().props.href, { pathname: "/beacon/[id]", params: { id: "event-1" } });
});