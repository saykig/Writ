import { expect, test } from "bun:test";
import * as mod from "../src/index.js";

test("@covenant/provenance module loads", () => {
  expect(mod).toBeDefined();
});
