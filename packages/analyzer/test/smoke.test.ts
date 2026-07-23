import { expect, test } from "bun:test";
import * as mod from "../src/index.js";

test("@covenant/analyzer module loads", () => {
  expect(mod).toBeDefined();
});
