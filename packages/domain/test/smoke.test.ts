import { expect, test } from "bun:test";
import * as mod from "../src/index.js";

test("@writ/domain module loads", () => {
  expect(mod).toBeDefined();
});
