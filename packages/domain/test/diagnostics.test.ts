import { describe, expect, test } from "bun:test";
import {
  DIAGNOSTIC_CATALOG,
  DIAGNOSTIC_CATALOG_VERSION,
  DIAGNOSTIC_CODES,
  getDiagnosticDefinition,
  makeDiagnostic,
  type DiagnosticCode,
} from "../src/diagnostics.js";

const REQUIRED_CODES: DiagnosticCode[] = [
  // Static score-analysis (ADR-0011).
  "WRT-SCORE-GAP",
  "WRT-SCORE-OVERLAP",
  "WRT-SCORE-UNREACHABLE",
  "WRT-SCORE-MONOTONICITY",
  // Evaluation-time (ADR-0011).
  "WRT-EVAL-DECISIVE-UNKNOWN",
  "WRT-EVAL-AMBIGUOUS",
  "WRT-EVAL-SAME-RESULT-OVERLAP",
  // Lint placeholders.
  "WRT-LINT-TYPE",
  "WRT-LINT-UNIT",
  "WRT-LINT-TIME-AXIS",
  "WRT-LINT-IDENTITY",
  "WRT-LINT-ATTRIBUTION",
  "WRT-LINT-SOURCE-RATIONALE",
  "WRT-LINT-MISSING-REFERENCE",
];

describe("diagnostic catalog", () => {
  test("has a versioned catalog", () => {
    expect(DIAGNOSTIC_CATALOG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("includes every required code from ADR-0011 and the lint placeholders", () => {
    for (const code of REQUIRED_CODES) {
      expect(DIAGNOSTIC_CODES).toContain(code);
      expect(DIAGNOSTIC_CATALOG[code]).toBeDefined();
    }
  });

  test("static and evaluation codes are kept in distinct categories", () => {
    expect(DIAGNOSTIC_CATALOG["WRT-SCORE-GAP"].category).toBe("score-analysis");
    expect(DIAGNOSTIC_CATALOG["WRT-EVAL-DECISIVE-UNKNOWN"].category).toBe("evaluation");
  });

  test("every entry has code, severity, category and a message template", () => {
    for (const code of DIAGNOSTIC_CODES) {
      const def = DIAGNOSTIC_CATALOG[code];
      expect(def.code).toBe(code);
      expect(["error", "warning", "info"]).toContain(def.severity);
      expect([
        "syntax",
        "type",
        "semantic-lint",
        "score-analysis",
        "evaluation",
        "provenance",
      ]).toContain(def.category);
      expect(def.messageTemplate.length).toBeGreaterThan(0);
    }
  });

  test("catalog is frozen (codes cannot be repurposed at runtime)", () => {
    expect(Object.isFrozen(DIAGNOSTIC_CATALOG)).toBe(true);
    expect(Object.isFrozen(DIAGNOSTIC_CATALOG["WRT-SCORE-GAP"])).toBe(true);
  });

  test("getDiagnosticDefinition returns the catalog entry", () => {
    expect(getDiagnosticDefinition("WRT-SCORE-OVERLAP")?.severity).toBe("error");
  });
});

describe("makeDiagnostic", () => {
  test("takes severity from the catalog and interpolates the message template", () => {
    const diagnostic = makeDiagnostic("WRT-LINT-TYPE", {
      values: { path: "/x", expected: "money", actual: "string" },
      location: { path: "/x" },
    });
    expect(diagnostic.code).toBe("WRT-LINT-TYPE");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.message).toBe("Type error at `/x`: expected `money`, found `string`.");
    expect(diagnostic.location).toEqual({ path: "/x" });
  });

  test("carries witness and context when provided", () => {
    const diagnostic = makeDiagnostic("WRT-SCORE-GAP", {
      values: { witness: "dimension=inclusion" },
      witness: { dimension: "inclusion" },
      context: { commitment: "c1" },
    });
    expect(diagnostic.witness).toEqual({ dimension: "inclusion" });
    expect(diagnostic.context).toEqual({ commitment: "c1" });
    expect(diagnostic.message).toContain("dimension=inclusion");
  });

  test("omits optional fields when not provided", () => {
    const diagnostic = makeDiagnostic("WRT-EVAL-AMBIGUOUS", { values: { path: "/score" } });
    expect("location" in diagnostic).toBe(false);
    expect("witness" in diagnostic).toBe(false);
    expect("context" in diagnostic).toBe(false);
  });

  test("throws for an unknown code", () => {
    expect(() => makeDiagnostic("WRT-NOPE" as DiagnosticCode)).toThrow();
  });
});
