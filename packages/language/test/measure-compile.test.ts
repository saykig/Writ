import { describe, expect, test } from "bun:test";
import { compileSource } from "../src/index.js";

const SOURCE = `language writ "0.1"
package test.gap_matrix version "1.0.0";

commitment GOVERNANCE_FIELD {
  title "Frontier AI governance field";
  subjects G7Members;
  evaluation_window [2025-01-01, 2026-01-01];
  evidence_policy open_world;
  unknown_policy propagate;
  action_identity strict_separate by id;

  measure knowledge_concentration {
    component operational_control weight 0.5 {
      anchor 0 when oc_level == 0;
      anchor 1 when oc_level == 1;
      anchor 2 when oc_level == 2;
      anchor 3 when oc_level == 3;
      anchor 4 when oc_level == 4;
    }
    component critical_resource_control weight 0.5 {
      anchor 0 when cr_level == 0;
      anchor 1 when cr_level == 1;
      anchor 2 when cr_level == 2;
      anchor 3 when cr_level == 3;
      anchor 4 when cr_level == 4;
    }
    aggregate weighted_ordinal_percent scale 4;
  }

  score {
    result "not_applicable" priority 0 when knowledge_concentration__public id measurement;
    otherwise not_applicable "This field's outcome is a graded measure; see measures.";
  }
}`;

describe("measure surface syntax compiles to canonical IR", () => {
  const result = compileSource(SOURCE, { fileName: "gap-matrix.writ" });

  test("compiles without link/parse diagnostics and validates against the schema", () => {
    expect(result.diagnostics.map((d) => d.code)).toEqual([]);
    expect(result.schemaValid).toBe(true);
  });

  test("lowers the measure, its components, anchors, and aggregation", () => {
    const measure = result.ir?.commitments[0]?.measures?.[0];
    expect(measure?.id).toBe("knowledge_concentration");
    expect(measure?.aggregation).toEqual({ strategy: "weighted_ordinal_percent", scale: 4 });
    expect(measure?.components.map((c) => c.id)).toEqual([
      "operational_control",
      "critical_resource_control",
    ]);
    expect(measure?.components[0]?.weight).toBe(0.5);
    expect(measure?.components[0]?.anchors.map((a) => a.value)).toEqual([0, 1, 2, 3, 4]);
  });
});
