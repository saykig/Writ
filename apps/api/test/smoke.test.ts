import { expect, test } from "bun:test";
import * as mod from "../src/index.js";

test("@writ/api module loads", () => {
  expect(mod).toBeDefined();
});
