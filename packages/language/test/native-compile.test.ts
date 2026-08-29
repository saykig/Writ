import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { compileSource } from "../src/index.js";

const NIST_RECORDS = fileURLToPath(
  new URL("../../../corpora/institutional/us/nist/records.writ", import.meta.url),
);
const NIST_JUDGMENTS = fileURLToPath(
  new URL("../../../corpora/institutional/us/nist/judgments.writ", import.meta.url),
);

describe("native record compilation", () => {
  test("a record-only document compiles without a commitment IR", () => {
    const result = compileSource(readFileSync(NIST_RECORDS, "utf8"), { fileName: NIST_RECORDS });
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.schemaValid).toBe(true);
    expect(result.records.length).toBeGreaterThan(0);
    expect("ir" in result).toBe(false);
  });

  test("compiler sources do not import retired execution packages", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../src/compile.ts", import.meta.url)),
      "utf8",
    );
    expect(source).not.toContain("@writ/evaluator");
    expect(source).not.toContain("@writ/analyzer");
  });

  test("NIST native objects match the reviewed compiler baseline", () => {
    const files = [NIST_RECORDS, NIST_JUDGMENTS];
    const compiled: Record<string, { records: unknown; judgments: unknown }> = {};
    for (const file of files) {
      const result = compileSource(readFileSync(file, "utf8"), { fileName: file });
      const relative = file.includes("records.writ")
        ? "corpora/institutional/us/nist/records.writ"
        : "corpora/institutional/us/nist/judgments.writ";
      compiled[relative] = { records: result.records, judgments: result.judgments };
    }
    const digest = createHash("sha256").update(JSON.stringify(compiled)).digest("hex");
    expect(digest).toBe("340eb45de5ac3980f1c1d1be93397eb6d6b163297e4192a71b42dc8fd8334eff");
  });
});
