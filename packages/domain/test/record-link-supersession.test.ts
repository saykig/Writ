/**
 * The Core record-link contract: record-to-record supersession and
 * institution-to-institution placement, with supporting records cited rather
 * than restated.
 */
import { describe, expect, test } from "bun:test";
import { RAW_SCHEMAS, validate } from "../src/index.js";

const link = {
  schema_version: "1.0.0",
  link_id: "link.example",
  owning_corpus_id: "us.institutions.nist",
  source_id: "record.example",
  source_kind: "record",
  target_id: "record.other",
  target_kind: "record",
  relation_type: "supersedes",
  basis: "direct",
  evidence_refs: ["passage.example"],
  uncertainties: [],
  provenance: { created_by: "test", created_at: "2026-08-04" },
  review_state: "draft",
} as const;

describe("record-to-record supersession", () => {
  test("`supersedes` is part of the relation vocabulary", () => {
    expect(validate("record-link", link).valid).toBe(true);
  });

  test("an unknown relation is still rejected", () => {
    expect(validate("record-link", { ...link, relation_type: "replaces" }).valid).toBe(false);
  });

  test("only the stored direction exists; the inverse is derived, never stored", () => {
    const defs = RAW_SCHEMAS["record-link"].$defs as Record<string, { enum?: string[] }>;
    const relations = defs.relationType?.enum ?? [];
    expect(relations).toContain("supersedes");
    expect(relations).not.toContain("superseded_by");
    expect(relations).not.toContain("part_of_inverse");
    expect(relations).not.toContain("contains");
  });
});

describe("institution-to-institution part_of", () => {
  const placement = {
    ...link,
    link_id: "link.nist.part-of.commerce",
    source_id: "nist",
    source_kind: "institution",
    target_id: "us_department_of_commerce",
    target_kind: "institution",
    relation_type: "part_of",
  } as const;

  test("a placement link validates", () => {
    expect(validate("record-link", placement).valid).toBe(true);
  });

  test("it can cite the record that already asserts the placement fact", () => {
    // The future NIST `part_of` link points at `nist_organizational_placement`
    // as its authoritative supporting fact instead of restating the assertion.
    expect(
      validate("record-link", {
        ...placement,
        supporting_record_ids: ["nist_organizational_placement"],
      }).valid,
    ).toBe(true);
  });

  test("supporting records are distinct identifiers and never empty", () => {
    expect(validate("record-link", { ...placement, supporting_record_ids: [] }).valid).toBe(false);
    expect(validate("record-link", { ...placement, supporting_record_ids: ["a", "a"] }).valid).toBe(
      false,
    );
  });

  test("a supporting record does not carry review approval to the link", () => {
    // `review_state` stays required and independent: citing an approved record
    // cannot be used to imply the link was reviewed.
    const { review_state: _dropped, ...withoutReviewState } = placement;
    expect(
      validate("record-link", {
        ...withoutReviewState,
        supporting_record_ids: ["nist_organizational_placement"],
      }).valid,
    ).toBe(false);
    for (const review_state of ["draft", "reviewed", "approved"] as const) {
      expect(
        validate("record-link", {
          ...placement,
          review_state,
          supporting_record_ids: ["nist_organizational_placement"],
        }).valid,
      ).toBe(true);
    }
  });
});

describe("the reusable link payload carries the same field", () => {
  test("`supporting_record_ids` is declared on the payload definition", () => {
    const defs = RAW_SCHEMAS["record-link"].$defs as Record<string, { properties?: object }>;
    const payload = defs.linkPayload?.properties as Record<string, unknown>;
    expect(payload.supporting_record_ids).toEqual({
      $ref: "#/$defs/supportingRecordIds",
    });
    // The payload is a reusable fragment, so it carries no independent review state.
    expect(payload.review_state).toBeUndefined();
  });
});
