/**
 * Supersession direction and the record/judgment vocabulary split.
 *
 * The v0.2 judgment contract states supersession explicitly at both ends. The
 * v0.1 contract is frozen and keeps its original undirected `supersedes` field.
 */
import { describe, expect, test } from "bun:test";
import {
  JUDGMENT_STATUSES,
  RAW_COMPATIBILITY_SCHEMAS,
  REVIEW_STATES,
  validate,
  validateJudgmentSupersession,
  validateVersion,
} from "../src/index.js";

const judgment = {
  schema_version: "0.2.0",
  judgment_id: "judgment.current",
  target_kind: "record",
  target_id: "record.us.nist.identity",
  judgment_type: "review_disposition",
  value: "accepted",
  rationale: "The cited passage supports the recorded institutional identity.",
  evidence_refs: ["nist.about.identity"],
  reviewer: "reviewer",
  status: "accepted",
  created_at: "2026-08-04",
} as const;

describe("v0.2 judgment supersession is directional", () => {
  test("an accepted judgment may list the older judgments it supersedes", () => {
    expect(
      validate("record-judgment", {
        ...judgment,
        supersedes_judgment_ids: ["judgment.earlier"],
      }).valid,
    ).toBe(true);
  });

  test("a superseded judgment must name its successor", () => {
    expect(
      validate("record-judgment", {
        ...judgment,
        status: "superseded",
        superseded_by_judgment_id: "judgment.later",
      }).valid,
    ).toBe(true);
    expect(validate("record-judgment", { ...judgment, status: "superseded" }).valid).toBe(false);
  });

  test("the successor pointer is rejected on a judgment that is not superseded", () => {
    expect(
      validate("record-judgment", {
        ...judgment,
        superseded_by_judgment_id: "judgment.later",
      }).valid,
    ).toBe(false);
  });

  test("an unaccepted judgment cannot claim to have superseded anything", () => {
    for (const status of ["proposed", "contested"] as const) {
      expect(
        validate("record-judgment", {
          ...judgment,
          status,
          supersedes_judgment_ids: ["judgment.earlier"],
        }).valid,
      ).toBe(false);
    }
  });

  test("the middle of a chain keeps both directions", () => {
    expect(
      validate("record-judgment", {
        ...judgment,
        status: "superseded",
        supersedes_judgment_ids: ["judgment.earlier"],
        superseded_by_judgment_id: "judgment.later",
      }).valid,
    ).toBe(true);
  });

  test("the retired undirected field is no longer part of the v0.2 contract", () => {
    expect(validate("record-judgment", { ...judgment, supersedes: "judgment.earlier" }).valid).toBe(
      false,
    );
  });

  test("review disposition is its own judgment type", () => {
    for (const judgment_type of ["review_disposition", "record_link_disposition"] as const) {
      expect(validate("record-judgment", { ...judgment, judgment_type }).valid).toBe(true);
    }
    expect(validate("record-judgment", { ...judgment, judgment_type: "invented" }).valid).toBe(
      false,
    );
  });
});

describe("the v0.1 judgment contract is preserved unchanged", () => {
  const legacy = {
    schema_version: "0.1.0",
    judgment_id: "judgment.legacy",
    target_record_id: "record.us.nist.identity",
    judgment_type: "legal_status_determination",
    value: "unknown",
    rationale: "The cited passage does not establish legal force.",
    evidence_refs: ["nist.about.identity"],
    reviewer: "reviewer",
    status: "superseded",
    supersedes: "judgment.older",
  } as const;

  test("the frozen schema still declares the original undirected field", () => {
    const schema = RAW_COMPATIBILITY_SCHEMAS["record-judgment"];
    const properties = schema.properties as Record<string, unknown>;
    expect(properties.supersedes).toBeDefined();
    expect(properties.supersedes_judgment_ids).toBeUndefined();
    expect(properties.superseded_by_judgment_id).toBeUndefined();
    expect(schema.allOf).toEqual([
      {
        if: { properties: { status: { const: "superseded" } }, required: ["status"] },
        then: { required: ["supersedes"] },
      },
    ]);
  });

  test("a v0.1 judgment still validates through its own contract", () => {
    expect(
      validateVersion("record-judgment", { ...legacy, created_at: "2026-08-03" }, "0.1.0").valid,
    ).toBe(true);
    expect(
      validateVersion(
        "record-judgment",
        { ...legacy, created_at: "2026-08-03", supersedes: undefined },
        "0.1.0",
      ).valid,
    ).toBe(false);
  });
});

describe("supersession graphs", () => {
  const accepted = (id: string, supersedes: string[]) => ({
    judgment_id: id,
    status: "accepted",
    supersedes_judgment_ids: supersedes,
  });
  const superseded = (id: string, by: string) => ({
    judgment_id: id,
    status: "superseded",
    superseded_by_judgment_id: by,
  });

  test("a three-link chain is valid in both directions", () => {
    expect(
      validateJudgmentSupersession([
        superseded("j1", "j2"),
        { ...superseded("j2", "j3"), supersedes_judgment_ids: ["j1"] },
        accepted("j3", ["j2"]),
      ]).valid,
    ).toBe(true);
  });

  test("a two-step chain with one accepted head is valid", () => {
    expect(
      validateJudgmentSupersession([superseded("j1", "j2"), accepted("j2", ["j1"])]).valid,
    ).toBe(true);
  });

  test("a proposed judgment cannot claim to have superseded anything", () => {
    expect(
      validateJudgmentSupersession([
        { judgment_id: "j1", status: "proposed", supersedes_judgment_ids: ["j0"] },
      ]).issues.map((issue) => issue.code),
    ).toContain("SUPERSEDES_REQUIRES_ACCEPTED");
  });

  test("self-supersession is rejected in both directions", () => {
    expect(
      validateJudgmentSupersession([accepted("j1", ["j1"])]).issues.map((issue) => issue.code),
    ).toContain("SELF_SUPERSESSION");
    expect(
      validateJudgmentSupersession([superseded("j1", "j1")]).issues.map((issue) => issue.code),
    ).toContain("SELF_SUPERSESSION");
  });

  test("a supersession cycle is rejected", () => {
    const cycle = validateJudgmentSupersession([
      accepted("j1", ["j2"]),
      accepted("j2", ["j3"]),
      accepted("j3", ["j1"]),
    ]);
    expect(cycle.valid).toBe(false);
    const reported = cycle.issues.filter((issue) => issue.code === "SUPERSESSION_CYCLE");
    expect(reported).toHaveLength(1);
    expect([...reported[0]!.cycle!].sort()).toEqual(["j1", "j2", "j3"]);
  });

  test("the two directions must agree", () => {
    expect(
      validateJudgmentSupersession([accepted("j2", ["j1"]), superseded("j1", "j9")]).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("DISAGREEING_DIRECTION");
  });

  test("a duplicate judgment id is rejected", () => {
    expect(
      validateJudgmentSupersession([
        { judgment_id: "j1", status: "proposed" },
        { judgment_id: "j1", status: "accepted" },
      ]).issues.map((issue) => issue.code),
    ).toContain("DUPLICATE_JUDGMENT_ID");
  });

  test("a reference outside the validated set is not an error", () => {
    expect(validateJudgmentSupersession([superseded("j1", "j-elsewhere")]).valid).toBe(true);
  });
});

describe("judgment status and review state are separate vocabularies", () => {
  test("the two vocabularies are what the contracts declare", () => {
    expect([...JUDGMENT_STATUSES]).toEqual(["proposed", "accepted", "contested", "superseded"]);
    expect([...REVIEW_STATES]).toEqual([
      "draft",
      "reviewed",
      "approved",
      "superseded",
      "withdrawn",
    ]);
  });

  test("`accepted` is not a record or record-link review state", () => {
    expect(REVIEW_STATES as readonly string[]).not.toContain("accepted");
    expect(
      validate("record-link", {
        schema_version: "1.0.0",
        link_id: "link.example",
        owning_corpus_id: "corpus.example",
        source_id: "record.example",
        source_kind: "record",
        target_id: "institution.example",
        target_kind: "institution",
        relation_type: "part_of",
        basis: "direct",
        evidence_refs: ["passage.example"],
        uncertainties: [],
        provenance: { created_by: "test", created_at: "2026-08-04" },
        review_state: "accepted",
      }).valid,
    ).toBe(false);
  });

  test("`approved` and `withdrawn` are not judgment statuses", () => {
    for (const status of ["approved", "withdrawn", "draft"]) {
      expect(validate("record-judgment", { ...judgment, status }).valid).toBe(false);
    }
  });
});
