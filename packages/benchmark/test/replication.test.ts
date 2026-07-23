/**
 * The frozen corpus re-derives from its own bytes, and any tampering is caught.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { replicate, recomputeContentHash } from "../src/replicate.js";
import { EVIDENCE_DIR } from "../src/paths.js";
import { join } from "node:path";

describe("frozen-evidence re-derivation", () => {
  test("every hash and score re-derives from the in-repo bytes", () => {
    const checks = replicate();
    const failures = checks.filter((c) => !c.ok);
    expect(failures.map((f) => `${f.name}: ${f.detail}`)).toEqual([]);
    // Sanity: the harness actually checked snapshots, a profile, and the benchmark.
    expect(checks.some((c) => c.name.startsWith("content_hash"))).toBe(true);
    expect(checks.some((c) => c.name.startsWith("benchmark reproduces"))).toBe(true);
  });

  test("a mutated quote breaks the snapshot's content_hash (tampering is detected)", () => {
    const file = readdirSync(EVIDENCE_DIR).find((f) => f.endsWith(".snapshot.json"))!;
    const snapshot = JSON.parse(readFileSync(join(EVIDENCE_DIR, file), "utf8"));
    const stored = snapshot.snapshot.content_hash as string;

    // Unmutated: re-derivation matches.
    expect(recomputeContentHash(snapshot)).toBe(stored);

    // Mutate one passage's quote (a single character) — the recomputed hash diverges.
    const target = snapshot.passages.find((p: { quote?: string }) => typeof p.quote === "string");
    expect(target).toBeDefined();
    target.quote = `${target.quote} `; // append a space
    expect(recomputeContentHash(snapshot)).not.toBe(stored);
  });
});
