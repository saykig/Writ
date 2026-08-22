import { describe, expect, test } from "bun:test";
import { validate, validateJudgmentSupersession, type WritRecord } from "@writ/domain";
import { compileSource } from "../src/index.js";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

interface SyntheticFact {
  id: string;
  assertionMode: "states" | "performs";
  assertion: string;
  passage: string;
  quote: string;
  fact: string;
}

function declaration(value: SyntheticFact): string {
  return `record ${value.id} : institutional {
  corpus synthetic.institutions.example;
  version "0.2.0";
  title "${value.id}";
  subjects { subject example_institute type institution role "subject"; };
  assertion ${value.assertionMode} "${value.assertion}";
  topics {};
  scope {
    jurisdictions { "Synthetic jurisdiction" };
    institutional_scope { example_institute };
    temporal_scope {}
    conditions {};
  }
  evidence {
    support synthetic.source document_version synthetic.source.v1 passage ${value.passage} locator "Synthetic section" quote "${value.quote}" passage_hash "${HASH_A}" document_hash "${HASH_B}" basis direct;
  }
  uncertainty { item unknown "No stronger institutional fact is established."; }
  provenance { created_by "Synthetic fixture"; created_at 2026-08-22; }
  review_state approved;
  institutional {
    institution_id example_institute;
    ${value.fact}
  }
}`;
}

const SYNTHETIC_SOURCE = `language writ "0.2"
package synthetic.institutions.example.records version "0.2.0";

${declaration({
  id: "example_mission",
  assertionMode: "states",
  assertion: "The institute states that its mission is to improve measurement practice.",
  passage: "synthetic.source.mission",
  quote: "Our mission is to improve measurement practice.",
  fact: `fact_type mission;
    mission {
      text "The institute states that its mission is to improve measurement practice.";
      source_ids { synthetic.source };
      evidence_refs { synthetic.source.mission };
    }`,
})}

${declaration({
  id: "example_function",
  assertionMode: "performs",
  assertion: "The institute publishes measurement guidance.",
  passage: "synthetic.source.function",
  quote: "The institute publishes measurement guidance.",
  fact: `fact_type function;
    function technical_guidance;`,
})}

${declaration({
  id: "example_placement",
  assertionMode: "states",
  assertion: "The institute is part of the example department.",
  passage: "synthetic.source.placement",
  quote: "The institute is part of the example department.",
  fact: `fact_type placement;
    parent_institution_id example_department;`,
})}
`;

const compiled = compileSource(SYNTHETIC_SOURCE, { fileName: "synthetic-records.writ" });
const records = new Map(compiled.records.map((record) => [record.record_id, record]));

function record(id: string): WritRecord & Record<string, unknown> {
  const value = records.get(id);
  if (!value) throw new Error(`Missing synthetic record ${id}`);
  return structuredClone(value) as WritRecord & Record<string, unknown>;
}

describe("synthetic institutional kernel", () => {
  test("compiles deterministically without NIST or machine-path knowledge", () => {
    expect(compiled.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records).toHaveLength(3);
    const alternate = compileSource(SYNTHETIC_SOURCE, {
      fileName: "/private/synthetic/workspace/records.writ",
    });
    expect(alternate.records).toEqual(compiled.records);
    expect(JSON.stringify(alternate.records)).toBe(JSON.stringify(compiled.records));
    expect(JSON.stringify(compiled.records).toLowerCase()).not.toContain("nist");
    for (const value of compiled.records) {
      expect(value).toMatchObject({
        schema_version: "0.2.0",
        record_version: "0.2.0",
        corpus_id: "synthetic.institutions.example",
        family: "institutional",
      });
      expect(JSON.stringify(value)).not.toContain("/private/synthetic/workspace");
    }
  });

  test("rejects crossed atomic payloads mechanically", () => {
    const missionWithMandate = record("example_mission");
    missionWithMandate.mandate = { status: "established" };
    expect(validate("institutional-record", missionWithMandate).valid).toBe(false);

    const functionWithCapacity = record("example_function");
    functionWithCapacity.operational_capacity = {
      status: "active",
      capacity_type: "technical_capability",
      evidence_refs: ["synthetic.source.function"],
    };
    expect(validate("institutional-record", functionWithCapacity).valid).toBe(false);
  });
});

describe("explicit human-review boundaries", () => {
  test("cannot mechanically read mission text and reject a mandate label", () => {
    const mislabeled = record("example_mission");
    delete mislabeled.mission;
    mislabeled.institutional_fact_type = "mandate";
    mislabeled.mandate = {
      status: "established",
      text: "Improve measurement practice.",
      authority_source_ids: ["synthetic.source"],
      evidence_refs: ["synthetic.source.mission"],
    };
    expect(validate("institutional-record", mislabeled).valid).toBe(true);
  });

  test("cannot mechanically read a function passage and reject capacity", () => {
    const mislabeled = record("example_function");
    delete mislabeled.function;
    mislabeled.institutional_fact_type = "operational_capacity";
    mislabeled.operational_capacity = {
      status: "active",
      capacity_type: "technical_capability",
      evidence_refs: ["synthetic.source.function"],
    };
    expect(validate("institutional-record", mislabeled).valid).toBe(true);
  });

  test("cannot mechanically turn placement prose into or away from a decision right", () => {
    const mislabeled = record("example_placement");
    delete mislabeled.parent_institution_id;
    mislabeled.institutional_fact_type = "decision_right";
    mislabeled.decision_right = {
      status: "established",
      text: "Exercise authority over the institute.",
      evidence_refs: ["synthetic.source.placement"],
    };
    expect(validate("institutional-record", mislabeled).valid).toBe(true);
  });

  test("does not pretend that schema validity authorizes certainty or accepted mutation", () => {
    const unsupportedCertainty = record("example_mission");
    unsupportedCertainty.uncertainties = [];
    expect(validate("institutional-record", unsupportedCertainty).valid).toBe(true);

    const mutatedAcceptedRecord = record("example_mission");
    mutatedAcceptedRecord.assertion = {
      mode: "states",
      text: "An accepted assertion was edited without supersession.",
    };
    expect(validate("institutional-record", mutatedAcceptedRecord).valid).toBe(true);
  });

  test("does not invent a conflict rule for independent accepted judgments", () => {
    const judgments = [
      {
        judgment_id: "synthetic_acceptance_one",
        status: "accepted",
      },
      {
        judgment_id: "synthetic_acceptance_two",
        status: "accepted",
      },
    ];
    expect(validateJudgmentSupersession(judgments).valid).toBe(true);
  });
});
