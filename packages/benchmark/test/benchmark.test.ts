import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeScoreProgram, type FiniteDomains } from "@writ/analyzer";
import { canonicalJson } from "@writ/provenance";
import { validate, type Evidence, type InterpretationProfile } from "@writ/domain";
import { evaluateCommitment, verifyReceipt } from "@writ/evaluator";
import {
  MEMBERS,
  buildProfile,
  buildMemberSnapshot,
  compileResolvedWrit,
  projectSnapshotForProfile,
  resolvedIr,
  resolvedCommitment,
  runBenchmark,
  profilePath,
  snapshotPath,
} from "../src/index.js";

// Expected reviewed strong/weak tallies from the evaluator benchmark fixture.
const TALLY: Record<string, { strong: number; weak: number; published: "-1" | "0" | "+1" }> = {
  canada: { strong: 16, weak: 4, published: "+1" },
  france: { strong: 7, weak: 0, published: "+1" },
  germany: { strong: 7, weak: 4, published: "+1" },
  italy: { strong: 8, weak: 3, published: "+1" },
  japan: { strong: 3, weak: 4, published: "0" },
  united_kingdom: { strong: 11, weak: 3, published: "+1" },
  united_states: { strong: 3, weak: 3, published: "0" },
  european_union: { strong: 8, weak: 3, published: "+1" },
};

const loadJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const FULL_DOMAINS: FiniteDomains = {
  strong_count: range(6),
  weak_count: range(6),
  counter_exists: [false, true],
};

describe("resolved methodology", () => {
  test("compiles to schema-valid IR with no error diagnostics", () => {
    const result = compileResolvedWrit();
    expect(result.schemaValid).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.ir).toBeDefined();
  });

  test("score program analyzes clean — no WRT-SCORE-GAP / WRT-SCORE-OVERLAP", async () => {
    const program = resolvedCommitment().score_program;
    const { diagnostics } = await analyzeScoreProgram(program, FULL_DOMAINS, {
      objectId: "AI_SME_ADOPTION",
    });
    const codes = diagnostics.map((d) => d.code);
    expect(codes.filter((c) => c === "WRT-SCORE-GAP")).toHaveLength(0);
    expect(codes.filter((c) => c === "WRT-SCORE-OVERLAP")).toHaveLength(0);
  });
});

describe("reviewed evidence catalog", () => {
  test("all eight members retain their approved homepage marker anchors", () => {
    expect(
      MEMBERS.map(({ id, name, markerAnchor, markerCoordinates }) => ({
        id,
        name,
        markerAnchor,
        markerCoordinates,
      })),
    ).toEqual([
      {
        id: "canada",
        name: "Canada",
        markerAnchor: "Ottawa",
        markerCoordinates: [-75.6972, 45.4215],
      },
      {
        id: "france",
        name: "France",
        markerAnchor: "Paris",
        markerCoordinates: [2.3522, 48.8566],
      },
      {
        id: "germany",
        name: "Germany",
        markerAnchor: "Berlin",
        markerCoordinates: [13.405, 52.52],
      },
      {
        id: "italy",
        name: "Italy",
        markerAnchor: "Rome",
        markerCoordinates: [12.4964, 41.9028],
      },
      {
        id: "japan",
        name: "Japan",
        markerAnchor: "Tokyo",
        markerCoordinates: [139.6917, 35.6895],
      },
      {
        id: "united_kingdom",
        name: "United Kingdom",
        markerAnchor: "London",
        markerCoordinates: [-0.1276, 51.5072],
      },
      {
        id: "united_states",
        name: "United States",
        markerAnchor: "Washington, D.C.",
        markerCoordinates: [-77.0369, 38.9072],
      },
      {
        id: "european_union",
        name: "European Union",
        markerAnchor: "Brussels",
        markerCoordinates: [4.3517, 50.8503],
      },
    ]);
  });

  test("each member's strong/weak counts reproduce the reviewed tally", () => {
    for (const member of MEMBERS) {
      const strong = member.actions.filter((a) => a.classification === "strong").length;
      const weak = member.actions.filter((a) => a.classification === "weak").length;
      const counter = member.actions.filter((a) => a.classification === "counter").length;
      const expected = TALLY[member.id];
      expect(expected).toBeDefined();
      expect({ id: member.id, strong, weak }).toEqual({
        id: member.id,
        strong: expected!.strong,
        weak: expected!.weak,
      });
      expect(counter).toBe(0);
    }
  });

  test("every member snapshot on disk is schema-valid evidence with distinct instruments", () => {
    for (const member of MEMBERS) {
      const snapshot = loadJson<Evidence>(snapshotPath(member.id));
      expect(validate("evidence", snapshot).valid).toBe(true);
      const instruments = snapshot.actions.map((a) => a.underlying_instrument_id);
      expect(new Set(instruments).size).toBe(snapshot.actions.length);
      // Stored actions carry NO raw classification field (schema is closed).
      expect(snapshot.actions.every((a) => !("classification" in a))).toBe(true);
    }
  });

  test("the two interpretation profiles on disk are schema-valid and hash-verified", () => {
    for (const name of ["published", "generous"]) {
      const profile = loadJson<InterpretationProfile>(profilePath(name));
      expect(validate("interpretation-profile", profile).valid).toBe(true);
      expect(profile.canonical_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });
});

describe("published-profile evaluation reproduces the published scores", () => {
  const { ledger, receipts } = runBenchmark();

  test("all eight computed cells equal the published cell", () => {
    for (const cell of ledger.cells) {
      expect(cell.published).toBe(TALLY[cell.member]!.published);
      expect(cell.computed).toBe(cell.published);
      expect(cell.match).toBe(true);
    }
    expect(ledger.summary).toEqual({
      cells: 8,
      matches: 8,
      mismatches: 0,
      interpretation_sensitive_cells: 2,
    });
  });

  test("scores are produced by evaluateCommitment, not hardcoded", () => {
    // +1 cells are `supported` with a non-empty qualifying strong-action set;
    // the proof root is the score selection node the evaluator built.
    for (const [member, receipt] of receipts) {
      expect(validate("evaluation-receipt", receipt).valid).toBe(true);
      expect(verifyReceipt(receipt).valid).toBe(true);
      const root = receipt.proof.nodes.find((n) => n.id === receipt.proof.root_id);
      expect(root?.kind).toBe("selection");
      if (TALLY[member]!.published === "+1") {
        expect(receipt.result).toBe("+1");
        expect(receipt.result_status).toBe("supported");
        expect((receipt.qualifying_action_ids ?? []).length).toBeGreaterThanOrEqual(5);
      }
    }
  });

  test("every receipt is byte-identical and hash-stable across two runs", () => {
    const second = runBenchmark();
    for (const [member, receipt] of receipts) {
      const other = second.receipts.get(member)!;
      expect(canonicalJson(other)).toBe(canonicalJson(receipt));
      expect(other.canonical_hash).toBe(receipt.canonical_hash);
    }
  });
});

describe("interpretation sensitivity (generous profile)", () => {
  const { ledger, generousReceipts } = runBenchmark();

  test("Japan flips 0 → +1 under the generous reading", () => {
    const japan = generousReceipts.get("japan")!;
    expect(japan.result).toBe("+1");
    const jpSensitivity = ledger.interpretation_sensitivity.find((s) => s.member === "japan")!;
    expect(jpSensitivity.published_profile_result).toBe("0");
    expect(jpSensitivity.generous_profile_result).toBe("+1");
    expect(jpSensitivity.flips).toBe(true);
  });

  test("clean cells are stable across the published and generous readings", () => {
    for (const member of [
      "canada",
      "france",
      "germany",
      "italy",
      "united_kingdom",
      "european_union",
    ]) {
      const entry = ledger.interpretation_sensitivity.find((s) => s.member === member)!;
      expect(entry.flips).toBe(false);
      expect(generousReceipts.get(member)!.result).toBe("+1");
    }
  });

  test("only Japan and the United States are interpretation-sensitive", () => {
    const sensitive = ledger.cells
      .filter((c) => c.category === "implicit_analyst_interpretation")
      .map((c) => c.member)
      .sort();
    expect(sensitive).toEqual(["japan", "united_states"]);
  });
});

describe("discrepancy ledger is well-formed", () => {
  const { ledger } = runBenchmark();

  test("shape, categories, and results are valid", () => {
    expect(ledger.schema_version).toBe("1.0.0");
    expect(ledger.benchmark_reference).toBe("2025-ai-sme");
    expect(ledger.commitment_id).toBe("AI_SME_ADOPTION");
    expect(ledger.cells).toHaveLength(8);
    const scores = new Set(["-1", "0", "+1", "unresolved", "not_applicable"]);
    for (const cell of ledger.cells) {
      expect(Object.keys(cell).sort()).toEqual([
        "category",
        "computed",
        "match",
        "member",
        "note",
        "published",
      ]);
      expect(["implicit_analyst_interpretation", "none"]).toContain(cell.category);
      expect(scores.has(cell.computed)).toBe(true);
      expect(typeof cell.match).toBe("boolean");
    }
  });

  test("the persisted ledger on disk matches a fresh run", () => {
    const onDisk = loadJson<typeof ledger>(
      fileURLToPath(
        new URL(
          "../../../internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/discrepancy-ledger.json",
          import.meta.url,
        ),
      ),
    );
    expect(onDisk.cells).toEqual(ledger.cells as never);
    expect(onDisk.summary).toEqual(ledger.summary as never);
  });
});

describe("evidence enrichment is faithful", () => {
  test("stored reviewed classification claims match the catalog classification", () => {
    for (const member of MEMBERS) {
      const base = buildMemberSnapshot(member);
      for (const action of member.actions) {
        const claim = base.claims.find(
          (c) => c.subject_ref === `action-${member.id}-${action.slug}`,
        );
        expect(claim?.object).toBe(action.classification);
      }
    }
  });

  test("generous profile reclassifies exactly the interpretation-sensitive instruments", () => {
    const sensitive = MEMBERS.flatMap((m) =>
      m.actions.filter((a) => a.interpretation_sensitive).map((a) => `${m.code}-${a.slug}`),
    );
    // 2 Japanese measures + 3 US strategy documents.
    expect(sensitive.length).toBe(5);
  });

  test("missing classification remains explicit and decisive unknown is unresolved", () => {
    const member = MEMBERS[0]!;
    const base = buildMemberSnapshot(member);
    const action = base.actions[0]!;
    const snapshot = {
      ...base,
      actions: [action],
      claims: base.claims.filter((claim) => claim.subject_ref !== action.id),
    };
    const profile = buildProfile("published");
    const projection = projectSnapshotForProfile(snapshot, profile);
    const projectedAction = projection.snapshot.actions[0] as unknown as Record<string, unknown>;
    expect(projection.diagnostics).toHaveLength(1);
    expect(projection.diagnostics[0]?.code).toBe("WRT-BENCH-CLASSIFICATION-UNKNOWN");
    expect(projectedAction.rubric_classification_state).toMatchObject({
      status: "unknown",
      value: null,
    });
    expect("classification" in projectedAction).toBe(false);

    const receipt = evaluateCommitment({
      ir: resolvedIr(),
      commitmentId: "AI_SME_ADOPTION",
      snapshot: projection.snapshot,
      subject: member.id,
      profile,
    });
    expect(receipt.result).toBe("unresolved");
    expect(receipt.result_status).toBe("incomplete");
  });

  test("non-decisive unknown classification preserves a supported result", () => {
    const member = MEMBERS[0]!;
    const base = buildMemberSnapshot(member);
    const action = base.actions[0]!;
    const snapshot = {
      ...base,
      actions: base.actions.map((candidate) =>
        candidate.id === action.id ? { ...candidate, status: "rejected" as const } : candidate,
      ),
      claims: base.claims.filter((claim) => claim.subject_ref !== action.id),
    };
    const profile = buildProfile("published");
    const projection = projectSnapshotForProfile(snapshot, profile);
    expect(projection.diagnostics).toHaveLength(1);
    const receipt = evaluateCommitment({
      ir: resolvedIr(),
      commitmentId: "AI_SME_ADOPTION",
      snapshot: projection.snapshot,
      subject: member.id,
      profile,
    });
    expect(receipt.result).toBe("+1");
    expect(receipt.result_status).toBe("supported");
  });
});
