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

const { homeContent } = load("constants/homeContent.ts");
const theme = load("theme/theme.ts", { "./colors": load("theme/colors.ts") });
const colors = load("theme/colors.ts");
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

test("hero CTAs navigate to discovery and saved events, keeping existing profile and alert access", () => {
  const paths = [];
  const { HeroSection } = load("components/home/HeroSection.tsx", {
    ...base, "react-native": rn, "expo-image": { Image: "Image" },
    "expo-router": { router: { push: (route) => paths.push(route) } },
    "../../../assets/images/RaveOrbLogo2.png": "logo",
    "./HomeButton": { HomeButton: "HomeButton" },
  });
  const screen = HeroSection({ alertCount: 0, changedCount: 0, updatesError: false });
  const buttons = find(screen, (element) => element.type === "HomeButton");
  assert.deepEqual(buttons.map((button) => button.props.label), [homeContent.hero.primaryCta, homeContent.hero.secondaryCta]);
  buttons.forEach((button) => button.props.onPress());
  find(screen, (element) => element.type === "Pressable").forEach((item) => item.props.onPress());
  assert.deepEqual(paths, ["/(tabs)/events", "/event-changes", "/my-raveorb", "/artist-alerts"]);
});

test("pillars use requested order and routes, with the unavailable crew card non-tappable", () => {
  const paths = [];
  const { PillarCard } = load("components/home/PillarCard.tsx", {
    ...base, "react-native": rn, "@expo/vector-icons": icon,
    "expo-router": { router: { push: (route) => paths.push(route) } },
  });
  assert.deepEqual(homeContent.pillars.map((pillar) => pillar.key), ["discover", "capture", "connect", "orbit"]);
  const cards = homeContent.pillars.map((pillar) => PillarCard({ pillar, wide: false }));
  assert.equal(cards[2].type, "View");
  assert.equal(cards[2].props.onPress, undefined);
  for (const card of cards.filter((item) => item.type === "Pressable")) {
    assert.equal(card.props.accessibilityRole, "button");
    assert.ok(card.props.accessibilityLabel);
    card.props.onPress();
  }
  assert.deepEqual(paths, ["/(tabs)/events", "/(tabs)/nights", "/orbit"]);
});

test("pillar grid adapts to viewport and font scaling", () => {
  const render = (width, fontScale) => load("components/home/PillarGrid.tsx", {
    ...base, "react-native": { ...rn, useWindowDimensions: () => ({ width, fontScale }) },
    "./PillarCard": { PillarCard: "PillarCard" },
  }).PillarGrid();
  for (const [width, scale, wide] of [[390, 1, false], [800, 1, true], [800, 2, false]]) {
    const cards = find(render(width, scale), (element) => element.type === "PillarCard");
    assert.equal(cards.length, 4);
    assert.ok(cards.every((card) => card.props.wide === wide));
  }
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
      useState: (initial) => [typeof initial === "boolean" ? reduceMotion : initial(), () => {}],
      useEffect: (effect) => effects.push(effect),
    },
    "react-native": { ...rn, Animated: animated, Platform: { OS: "ios" }, AccessibilityInfo: {
      addEventListener: () => ({ remove() {} }), isReduceMotionEnabled: async () => reduceMotion,
    } },
    "@expo/vector-icons": icon,
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "expo-router": { router: { push: (route) => paths.push(route) }, useIsFocused: () => focused },
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
    const cleanup = result.effects[1]();
    assert.equal(result.counts().started, expected);
    if (cleanup) cleanup();
    assert.equal(result.counts().stopped, expected);
  }
});

test("Home retains the requested section order and only passes eligible events to the spotlight", () => {
  const state = [[{ id: "eligible" }, { id: "other" }], false, 0, new Date(), 0, 0, false];
  let index = 0;
  const screen = load("screens/HomeScreen.tsx", {
    react: { useCallback: (callback) => callback, useState: () => [state[index++], () => {}] },
    "expo-router": { useFocusEffect() {} },
    "react-native": rn,
    "../components/home/BeaconSpotlight": { BeaconSpotlight: "BeaconSpotlight" },
    "../components/home/HeroSection": { HeroSection: "HeroSection" },
    "../components/home/PillarGrid": { PillarGrid: "PillarGrid" },
    "../components/Screen": { Screen: "Screen" },
    "../constants/homeContent": { homeContent },
    "../lib/beacon": { isBeaconWindow: (event) => event.id === "eligible" },
    "../lib/beaconDevOverrides": { useBeaconDevOverrides() {} },
    "../lib/eventStatusStorage": {}, "../lib/artistMatching": {},
    "../services/artistAlertsService": {}, "../services/eventChangesService": {}, "../services/eventsRepository": {},
    "../theme/colors": colors, "../theme/spacing": spacing,
  }).default();
  assert.deepEqual(screen.props.children.map((item) => item.type), ["HeroSection", "BeaconSpotlight", "PillarGrid", "Text"]);
  assert.deepEqual(screen.props.children[1].props.events.map((event) => event.id), ["eligible"]);
  assert.equal(screen.props.children[3].props.children, homeContent.closing);
});
