import { expect, test } from "bun:test";
import * as mod from "../src/index.js";

test("@covenant/evaluator module loads", () => {
  expect(mod).toBeDefined();
});
