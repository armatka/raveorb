const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { ESLint } = require("eslint");

test("source navigation imports require Expo Router", async () => {
  const eslint = new ESLint({ cwd: path.resolve(__dirname, "..") });
  for (const name of ["@react-navigation/native", "@react-navigation/native-stack", "@react-navigation/native/lib"]) {
    const [result] = await eslint.lintText(`import { hook } from "${name}";`, { filePath: "src/navigation-rule-test.ts" });
    const restricted = result.messages.filter((message) => message.ruleId === "no-restricted-imports");
    assert.equal(restricted.length, 1, name);
    assert.match(restricted[0].message, /Import navigation hooks from expo-router instead\./);
  }
  const [allowed] = await eslint.lintText('import { useRouter } from "expo-router";', { filePath: "src/navigation-rule-test.ts" });
  assert.equal(allowed.messages.some((message) => message.ruleId === "no-restricted-imports"), false);
});
