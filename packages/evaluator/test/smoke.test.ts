import { expect, test } from "bun:test";
import * as mod from "../src/index.js";

test("@writ/evaluator module loads", () => {
  expect(mod).toBeDefined();
});
