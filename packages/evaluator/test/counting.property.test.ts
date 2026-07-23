import { describe, expect, test } from "bun:test";
import type { CountInterval, Expr, QueryExpr } from "@writ/domain";
import { EvalContext, evaluateQuery, type Environment, type EvidenceRecord } from "../src/index.js";

// A deterministic, seedable PRNG (mulberry32) — the evaluator must be pure, and
// so must its property tests: no Math.random, no wall clock.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const whereStrong: Expr = { kind: "ref", path: "strong" };
const MEMBERSHIP = ["true", "unknown", "contested", "false"] as const;

function randomActions(rng: () => number, n: number): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];
  for (let i = 0; i < n; i += 1) {
    const membership = MEMBERSHIP[Math.floor(rng() * MEMBERSHIP.length)] ?? "false";
    // ~30% of records have an unknown identity (no pid); others draw from a small
    // key space so duplicates are common.
    const hasKey = rng() > 0.3;
    const record: Record<string, unknown> = { id: `n${i}`, strong: membership };
    if (hasKey) record["pid"] = `P${Math.floor(rng() * 4)}`;
    records.push(record);
  }
  return records;
}

function countDistinct(
  records: EvidenceRecord[],
  policy: Environment["actionIdentity"]["policy"],
): CountInterval {
  const env: Environment = {
    facts: {},
    collections: { actions: records },
    actionIdentity: { policy, key_paths: ["pid"] },
    temporal: { as_of: "2026-07-22T00:00:00Z", cutoff: "2026-07-22T00:00:00Z" },
    scoreDecisive: false,
  };
  const expr: QueryExpr = {
    kind: "query",
    operation: "count_distinct",
    collection: "actions",
    where: whereStrong,
  };
  return evaluateQuery(expr, new EvalContext(env)).countInterval as CountInterval;
}

describe("counting invariants hold for random finite action sets", () => {
  test("min <= max, and dedup <= propagate.max <= separate across 400 samples", () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const rng = mulberry32(seed);
      const n = Math.floor(rng() * 12); // 0..11 actions
      const records = randomActions(rng, n);

      const dedup = countDistinct(records, "strict_deduplicate");
      const separate = countDistinct(records, "strict_separate");
      const propagate = countDistinct(records, "propagate_uncertainty");

      const label = `seed=${seed} n=${n}`;
      // Every interval is well-formed.
      for (const [name, interval] of [
        ["dedup", dedup],
        ["separate", separate],
        ["propagate", propagate],
      ] as const) {
        expect(interval.min, `${name} min<=max ${label}`).toBeLessThanOrEqual(interval.max);
        expect(interval.min, `${name} min>=0 ${label}`).toBeGreaterThanOrEqual(0);
      }

      // The task ordering: strict_deduplicate <= propagate.max <= strict_separate.
      expect(dedup.max, `dedup.max<=propagate.max ${label}`).toBeLessThanOrEqual(propagate.max);
      expect(propagate.max, `propagate.max<=separate.max ${label}`).toBeLessThanOrEqual(
        separate.max,
      );

      // Lower bounds: merged (dedup/propagate) never exceeds separate's lower bound.
      expect(dedup.min, `dedup.min<=separate.min ${label}`).toBeLessThanOrEqual(separate.min);
      expect(propagate.min, `propagate.min==dedup.min ${label}`).toBe(dedup.min);

      // Unknown membership only ever widens the max, never lifts the min above the
      // definitely-true distinct floor: propagate.min equals the dedup lower bound.
      expect(propagate.max, `propagate.max==separate.max ${label}`).toBe(separate.max);
    }
  });
});
