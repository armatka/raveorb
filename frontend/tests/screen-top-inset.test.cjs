const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const src = path.resolve(__dirname, "../src");

function load(file, mocks) {
  const filename = path.join(src, file);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name in mocks ? mocks[name] : require(name);
  loaded._compile(output, filename);
  return loaded.exports;
}

test("Screen keeps the top safe area outside content on iOS and Android", () => {
  for (const os of ["ios", "android"]) {
    const { Screen } = load("components/Screen.tsx", {
      "react-native": {
        KeyboardAvoidingView: "KeyboardAvoidingView",
        Platform: { OS: os },
        ScrollView: "ScrollView",
        StyleSheet: { create: (styles) => styles },
      },
      "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
      "../theme/colors": { colors: { background: "#123" } },
    });

    for (const scrollable of [false, true]) {
      const screen = Screen({ children: "content", scrollable, edges: ["left", "right"], style: { backgroundColor: "#000" } });
      assert.equal(screen.type, "SafeAreaView");
      assert.deepEqual(screen.props.edges, ["top", "left", "right"]);
      assert.deepEqual(screen.props.style.map((style) => style.backgroundColor), ["#123", "#000"]);
      if (scrollable) {
        const scroll = os === "android" ? screen.props.children.props.children : screen.props.children;
        if (os === "android") assert.equal(screen.props.children.type, "KeyboardAvoidingView");
        assert.equal(scroll.type, "ScrollView");
        assert.equal(scroll.props.contentInsetAdjustmentBehavior, "never");
        assert.equal(scroll.props.children, "content");
      } else {
        assert.equal(screen.props.children, "content");
      }
    }
    assert.deepEqual(Screen({ children: null }).props.edges, ["top", "bottom"]);
  }
});

test("ScreenHeader adds spacing but not a second safe-area inset", () => {
  const { ScreenHeader } = load("components/ScreenHeader.tsx", {
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "react-native": { Pressable: "Pressable", StyleSheet: { create: (styles) => styles }, Text: "Text", View: "View" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => { throw new Error("Header must not use safe-area insets"); } },
    "../theme/colors": { colors: {} },
    "../theme/spacing": { spacing: { sm: 8 } },
  });
  assert.equal(ScreenHeader({}).props.style.paddingTop, 8);
});

test("the root sets a light status bar", () => {
  const { default: RootLayout } = load("app/_layout.tsx", {
    "expo-router": { Stack: "Stack" },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "react-native-safe-area-context": { SafeAreaProvider: "SafeAreaProvider" },
  });
  const root = RootLayout();
  assert.equal(root.props.children[0].type, "StatusBar");
  assert.equal(root.props.children[0].props.style, "light");
  assert.equal(root.props.children[1].props.screenOptions.headerShown, false);
});

test("screen callers cannot supply a conflicting top edge", () => {
  function visitDirectory(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visitDirectory(filename);
      } else if (entry.name.endsWith(".tsx")) {
        const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        function visit(node) {
          if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === "Screen") {
            const edges = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "edges");
            if (edges) {
              const expression = edges.initializer && ts.isJsxExpression(edges.initializer) && edges.initializer.expression;
              assert.ok(expression && ts.isArrayLiteralExpression(expression), `${filename}: Screen edges must be explicit`);
              assert.ok(expression.elements.every((edge) => ts.isStringLiteral(edge) && edge.text !== "top"), `${filename}: Screen must own the top edge`);
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  visitDirectory(src);
});
