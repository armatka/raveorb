const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function renderScreen(available, dev, options = {}) {
  const filename = path.resolve(__dirname, "../src/screens/EventDetailScreen.tsx");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const event = {
    id: "event", title: "Night", venueName: "Venue", city: "Toronto",
    countryCode: "CA", date: "2030-06-07", startTime: "23:00", endTime: "",
    timezone: "America/Toronto", genres: [], artists: [], description: "",
  };
  let stateIndex = 0;
  const component = () => null;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => {
    if (name === "react") return {
      useCallback: (callback) => callback,
      useState: (initial) => {
        const index = stateIndex++;
        return [index === 0 ? options.offline ? null : event : index === 1 ? options.snapshot ?? null
          : index === 2 ? options.status ?? null : index === 7 ? options.offline ? "Offline" : null
            : index === 14 ? options.festivalDays ?? [] : typeof initial === "boolean" ? false : initial, () => {}];
      },
    };
    if (name === "expo-router") return { router: {}, useFocusEffect() {}, useLocalSearchParams: () => ({ id: "event" }) };
    if (name === "@expo/vector-icons") return { Ionicons: component };
    if (name === "react-native") return {
      ActivityIndicator: "ActivityIndicator", Linking: {}, Pressable: "Pressable",
      StyleSheet: { create: (styles) => styles }, Text: "Text", View: "View",
    };
    if (name.startsWith("../components/")) return {
      __esModule: true, default: component, ArtistLinks: component, EmptyState: component,
      Screen: component, ScreenHeader: component, useFollowedArtists: () => ({ keys: [], toggle() {} }),
    };
    if (name === "../lib/eventFormatting") return {
      formatEventDate: () => "", formatEventPrice: () => "", formatEventSchedule: () => "",
    };
    if (name === "../lib/beacon") return { isBeaconWindow: (item) => options.windowDates ? options.windowDates.includes(item.date) : options.inWindow ?? false };
    if (name === "../lib/beaconDevOverrides") return { useBeaconDevOverrides() {} };
    if (name === "../services/calendarService") return { calendarService: { isAvailable: () => available } };
    if (name === "../theme/colors") return { colors: {} };
    if (name === "../theme/spacing") return { spacing: { sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } };
    if (name.startsWith("../lib/") || name.startsWith("../services/")) return {};
    return require(name);
  };
  loaded._compile(output, filename);
  const previousDev = global.__DEV__;
  global.__DEV__ = dev;
  try {
    return loaded.exports.default();
  } finally {
    if (previousDev === undefined) delete global.__DEV__;
    else global.__DEV__ = previousDev;
  }
}

function findElements(element, predicate) {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap((item) => findElements(item, predicate));
  return [
    ...(predicate(element) ? [element] : []),
    ...findElements(element.props?.children, predicate),
  ];
}

test("unavailable calendar shows a disabled hint only in development", () => {
  const hint = "Add to calendar (available in the full app)";
  const devScreen = renderScreen(false, true);
  const buttons = findElements(devScreen, (element) =>
    element.type === "Pressable" && element.props.children?.props?.children === hint);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.disabled, true);
  assert.equal(buttons[0].props.accessibilityState.disabled, true);
  assert.equal(findElements(renderScreen(false, false), (element) => element.props?.children === hint).length, 0);
});

test("Beacon entry appears only for Going events inside the window", () => {
  const entry = (screen) => findElements(screen, (element) => element.props?.children === "Beacon");
  assert.equal(entry(renderScreen(false, false, { status: "going", inWindow: true })).length, 1);
  assert.equal(entry(renderScreen(false, false, { status: "going", inWindow: false })).length, 0);
  assert.equal(entry(renderScreen(false, false, { status: "interested", inWindow: true })).length, 0);
});

test("Beacon can open during later saved festival days", () => {
  const entry = findElements(renderScreen(false, false, {
    status: "going", festivalDays: ["2030-06-07", "2030-06-08"], windowDates: ["2030-06-08"],
  }), (element) => element.props?.children === "Beacon");
  assert.equal(entry.length, 1);
});

test("available calendar shows the actionable button in a production build", () => {
  const buttons = findElements(renderScreen(true, false), (element) =>
    element.type === "Pressable" && element.props.accessibilityLabel === "Add to calendar");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.disabled, false);
  assert.equal(typeof buttons[0].props.onPress, "function");
});

test("event details show saved information when offline without inventing full event data", () => {
  const screen = renderScreen(false, false, { offline: true, snapshot: {
    title: "Saved night", date: "2030-06-07", startTime: "23:00", venueName: "Venue", city: "Toronto",
  } });
  assert.equal(findElements(screen, (element) => element.props?.children === "Saved night").length, 1);
  assert.equal(findElements(screen, (element) => element.props?.children === "Showing saved details. Full event details are unavailable.").length, 1);
  assert.equal(findElements(screen, (element) => element.props?.children === "Retry").length, 1);
});
