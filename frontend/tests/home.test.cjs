const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "../src", file);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name in mocks ? mocks[name] : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

function find(element, predicate) {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap((item) => find(item, predicate));
  return [...(predicate(element) ? [element] : []), ...find(element.props?.children, predicate)];
}

const colors = load("theme/colors.ts");
const { homeContent } = load("constants/homeContent.ts", { "../theme/colors": colors });
const theme = load("theme/theme.ts", { "./colors": load("theme/colors.ts") });
const spacing = load("theme/spacing.ts");
const base = {
  "../..": {},
  "../../constants/homeContent": { homeContent },
  "../../theme/theme": theme,
  "../../theme/colors": colors,
  "../../theme/spacing": spacing,
};
const rn = { Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: (styles) => styles } };
const icon = { Ionicons: "Ionicons" };

test("home hero sizes and centers the logo, preserves links and CTAs, and routes notices", () => {
  const paths = [];
  const { HomeHero } = load("components/home/HomeHero.tsx", {
    ...base,
    "react-native": { ...rn, useWindowDimensions: () => ({ width: 390, fontScale: 1 }) },
    "expo-router": { router: { push: (route) => paths.push(route) }, useIsFocused: () => true },
    "../../lib/useReduceMotion": { useReduceMotion: () => false },
    "../Logo": "Logo",
    "./HomeButton": { HomeButton: "HomeButton" },
  });
  const screen = HomeHero({ alertCount: 2, changedCount: 1, updatesError: true });
  const logo = find(screen, (element) => element.type === "Logo")[0];
  assert.equal(logo.props.size, 195);
  assert.equal(logo.props.animated, true);
  const buttons = find(screen, (element) => element.type === "HomeButton");
  assert.deepEqual(buttons.map((button) => button.props.label), [homeContent.hero.primaryCta, homeContent.hero.secondaryCta]);
  buttons.forEach((button) => button.props.onPress());
  find(screen, (element) => element.type === "Pressable").forEach((item) => item.props.onPress());
  assert.deepEqual(paths, [
    "/(tabs)/events", "/event-changes", "/my-raveorb", "/artist-alerts", "/event-changes",
  ]);
  assert.ok(find(screen, (element) => element.type === "Text" && element.props.children === homeContent.hero.updatesError).length);
});

test("home hero disables the logo pulse when unfocused or reduced motion is enabled", () => {
  for (const [focused, reduceMotion, animated] of [[false, false, false], [true, true, false], [true, false, true]]) {
    const { HomeHero } = load("components/home/HomeHero.tsx", {
      ...base,
      "react-native": { ...rn, useWindowDimensions: () => ({ width: 800, fontScale: 1 }) },
      "expo-router": { router: { push() {} }, useIsFocused: () => focused },
      "../../lib/useReduceMotion": { useReduceMotion: () => reduceMotion },
      "../Logo": "Logo",
      "./HomeButton": { HomeButton: "HomeButton" },
    });
    const screen = HomeHero({ alertCount: 0, changedCount: 0, updatesError: false });
    const logo = find(screen, (element) => element.type === "Logo")[0];
    assert.equal(logo.props.size, 280);
    assert.equal(logo.props.animated, animated);
  }
});

test("Logo uses an explicit size without clamping and stops its pulse when animation is disabled", () => {
  const effects = [];
  const pulse = { value: 0.8 };
  let cancelCount = 0;
  const { default: Logo } = load("components/Logo.tsx", {
    react: { useEffect: (effect) => effects.push(effect) },
    "react-native": { ...rn, useWindowDimensions: () => ({ width: 200 }) },
    "expo-image": { Image: "Image" },
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "../theme/theme": theme,
    "react-native-reanimated": {
      __esModule: true,
      default: { View: "AnimatedView" },
      cancelAnimation: () => { cancelCount++; },
      Easing: { inOut: (value) => value, ease: "ease" },
      useAnimatedStyle: (callback) => callback(),
      useSharedValue: () => pulse,
      withRepeat: () => "repeating-animation",
      withSequence: (...values) => values,
      withTiming: (value) => value,
    },
    "../../assets/images/RaveOrbLogo2.png": "logo",
  });
  const view = Logo({ size: 300, animated: false });
  const wrapper = view.props.style[1];
  assert.deepEqual(wrapper, { width: 300, height: 300, padding: 7.5 });
  effects[0]();
  assert.equal(pulse.value, 0);
  assert.equal(cancelCount, 1);
});

test("home panel grid contains all six panels in order and preserves their routes", () => {
  const paths = [];
  const { HomePanelGrid } = load("components/home/HomePanelGrid.tsx", {
    ...base,
    "react-native": { ...rn, useWindowDimensions: () => ({ width: 390, fontScale: 1 }) },
    "expo-router": { router: { push: (route) => paths.push(route) } },
    "./HomePanel": { HomePanel: "HomePanel" },
  });
  const grid = HomePanelGrid({ alertCount: 3 });
  const panels = find(grid, (element) => element.type === "HomePanel");
  assert.deepEqual(panels.map((panel) => panel.props.title), [
    "Find Your Night", "Capture the Moment", "Find Your Crew", "Your Orbit", "My RaveOrb", "Artist Alert",
  ]);
  assert.equal(panels[2].props.comingSoon, true);
  assert.deepEqual(panels.map((panel) => panel.props.testID), [
    "home-panel-discover", "home-panel-capture", "home-panel-connect",
    "home-panel-orbit", "home-panel-profile", "home-panel-artist-alerts",
  ]);
  assert.equal(panels[5].props.badge, "3 new");
  panels.forEach((panel) => panel.props.onPress?.());
  assert.deepEqual(paths, ["/(tabs)/events", "/(tabs)/nights", "/orbit", "/my-raveorb", "/artist-alerts"]);
});

test("home panel grid uses two columns at 340pt effective width and one below", () => {
  const render = (width, fontScale) => load("components/home/HomePanelGrid.tsx", {
    ...base, "react-native": { ...rn, useWindowDimensions: () => ({ width, fontScale }) },
    "expo-router": { router: { push() {} } },
    "./HomePanel": { HomePanel: "HomePanel" },
  }).HomePanelGrid({});
  for (const [width, scale, singleColumn] of [[375, 1, false], [393, 1, false], [339, 1, true], [480, 1.5, true]]) {
    const cards = find(render(width, scale), (element) => element.type === "HomePanel");
    assert.equal(cards.length, 6);
    assert.ok(cards.every((card) => card.props.singleColumn === singleColumn));
  }
});

test("coming-soon panel is disabled and identifies itself to accessibility", () => {
  const { HomePanel } = load("components/home/HomePanel.tsx", {
    ...base, "react-native": rn, "@expo/vector-icons": icon,
  });
  const panel = HomePanel({
    title: "Find Your Crew", subtitle: "Meet your people.", icon: "people-outline",
    accent: colors.platinum, testID: "home-panel-connect", comingSoon: true,
  });
  assert.equal(panel.type, "View");
  assert.equal(panel.props.onPress, undefined);
  assert.equal(panel.props.accessibilityState.disabled, true);
  assert.match(panel.props.accessibilityLabel, /coming soon/);
  const subtitle = find(panel, (element) => element.type === "Text" && element.props.children === "Meet your people.")[0];
  assert.equal(subtitle.props.numberOfLines, 2);
});

function spotlight({ reduceMotion = true, focused = true } = {}) {
  const effects = [];
  const paths = [];
  let started = 0;
  let stopped = 0;
  const animated = {
    Value: class { setValue() {} },
    View: "AnimatedView",
    timing: () => ({}), sequence: () => ({}),
    loop: () => ({ start() { started++; }, stop() { stopped++; } }),
  };
  const screen = load("components/home/BeaconSpotlight.tsx", {
    ...base,
    react: {
      useState: (initial) => [initial(), () => {}],
      useEffect: (effect) => effects.push(effect),
    },
    "react-native": { ...rn, Animated: animated, Platform: { OS: "ios" } },
    "@expo/vector-icons": icon,
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "expo-router": { router: { push: (route) => paths.push(route) }, useIsFocused: () => focused },
    "../../lib/useReduceMotion": { useReduceMotion: () => reduceMotion },
    "./HomeButton": { HomeButton: "HomeButton" },
  }).BeaconSpotlight({ events: [{ id: "1", title: "Test event" }], loadError: false, onRetry() {} });
  return { screen, effects, paths, counts: () => ({ started, stopped }) };
}

test("Beacon CTA and Tonight card navigate to the correct routes without promising automatic alerts", () => {
  const result = spotlight();
  const button = find(result.screen, (item) => item.type === "HomeButton")[0];
  const tonight = find(result.screen, (item) => item.type === "Pressable")[0];
  button.props.onPress();
  tonight.props.onPress();
  assert.equal(tonight.props.accessibilityLabel, "Open Beacon for Test event");
  assert.deepEqual(result.paths, ["/event-changes", { pathname: "/beacon/[id]", params: { id: "1" } }]);
  assert.match(homeContent.beacon.body, /Nothing is sent automatically/);
});

test("spotlight pulse only runs when focused and reduced motion is off", () => {
  for (const [reduced, focused, expected] of [[true, true, 0], [false, false, 0], [false, true, 1]]) {
    const result = spotlight({ reduceMotion: reduced, focused });
    const cleanup = result.effects[0]();
    assert.equal(result.counts().started, expected);
    if (cleanup) cleanup();
    assert.equal(result.counts().stopped, expected);
  }
});

test("useReduceMotion defaults on, reads the system setting and tracks live changes", async () => {
  let state = true;
  let listener;
  let removed = false;
  const effects = [];
  const { useReduceMotion } = load("lib/useReduceMotion.ts", {
    react: {
      useState: (initial) => [initial, (value) => { state = value; }],
      useEffect: (effect) => effects.push(effect),
    },
    "react-native": { AccessibilityInfo: {
      addEventListener: (name, handler) => { listener = handler; return { remove() { removed = true; } }; },
      isReduceMotionEnabled: async () => false,
    } },
  });
  assert.equal(useReduceMotion(), true);
  const cleanup = effects[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state, false);
  listener(true);
  assert.equal(state, true);
  cleanup();
  assert.equal(removed, true);
});

test("Home retains the requested section order and only passes eligible events to the spotlight", () => {
  const state = [[{ id: "eligible" }, { id: "other" }], false, 0, new Date(), 0, 0, false];
  let index = 0;
  const screen = load("screens/HomeScreen.tsx", {
    react: { useCallback: (callback) => callback, useState: () => [state[index++], () => {}] },
    "expo-router": { useFocusEffect() {} },
    "react-native": rn,
    "../components/home/BeaconSpotlight": { BeaconSpotlight: "BeaconSpotlight" },
    "../components/home/HomeHero": { HomeHero: "HomeHero" },
    "../components/home/HomePanelGrid": { HomePanelGrid: "HomePanelGrid" },
    "../components/Screen": { Screen: "Screen" },
    "../constants/homeContent": { homeContent },
    "../lib/beacon": { isBeaconWindow: (event) => event.id === "eligible" },
    "../lib/beaconDevOverrides": { useBeaconDevOverrides() {} },
    "../lib/eventStatusStorage": {}, "../lib/artistMatching": {},
    "../services/artistAlertsService": {}, "../services/eventChangesService": {}, "../services/eventsRepository": {},
    "../theme/colors": colors, "../theme/spacing": spacing,
  }).default();
  assert.deepEqual(screen.props.children.map((item) => item.type), ["HomeHero", "BeaconSpotlight", "HomePanelGrid", "Text"]);
  assert.equal(screen.props.children[2].props.alertCount, 0);
  assert.deepEqual(screen.props.children[1].props.events.map((event) => event.id), ["eligible"]);
  assert.equal(screen.props.children[3].props.children, homeContent.closing);
});
