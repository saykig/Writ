/**
 * Guards that the committed generated types in `src/generated/` are up to date
 * with the vendored schemas: regenerate each type and compare to the committed
 * file. Both sides are normalized through the same prettier pass so the check is
 * robust to the mandated `prettier --write` reformatting the committed files,
 * while still catching real drift (a schema changed but types were not
 * regenerated, or a generated file was hand-edited).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import prettier from "prettier";
import { generateOne, GENERATED_TYPES } from "../scripts/generate-types.js";

const GENERATED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "generated");

const normalize = (source: string): Promise<string> =>
  prettier.format(source, { parser: "typescript" });

describe("generated types are up to date", () => {
  for (const { file, name } of GENERATED_TYPES) {
    test(`${file}.ts matches a fresh generation`, async () => {
      const committed = readFileSync(join(GENERATED_DIR, `${file}.ts`), "utf8");
      const fresh = await generateOne(file, name);
      expect(await normalize(committed)).toBe(await normalize(fresh));
    });
  }
});
