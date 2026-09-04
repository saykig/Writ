import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  RAW_REVIEW_ARTIFACT_JUDGMENT_SCHEMA,
  REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID,
  SCHEMA_IDS,
  resolveSchemaVersion,
  validate,
  validateContract,
  validateJudgmentSupersession,
  validateVersion,
  type CurrentRecordJudgment,
} from "../src/index.js";

const binding = {
  path: "docs/reviews/human-disposition.yaml",
  content_hash: `sha256:${"a".repeat(64)}`,
};
const base = {
  judgment_id: "review_one",
  target_kind: "record" as const,
  target_id: "record_one",
  judgment_type: "review_disposition" as const,
  value: "approved",
  rationale: "Synthetic content association, not a real human disposition.",
  evidence_refs: ["source.passage"],
  reviewer: "Synthetic reviewer label; identity is not authenticated",
  status: "proposed" as const,
  created_at: "2026-09-04",
};
const bound = { ...base, schema_version: "0.3.0", review_artifact: binding };

describe("additive review-artifact judgment contract", () => {
  test("keeps old unbound contracts valid without reinterpreting absence", () => {
    expect(validate("record-judgment", { ...base, schema_version: "0.2.0" }).valid).toBe(true);
    expect(validate("record-judgment", { ...base, schema_version: "0.3.0" }).valid).toBe(true);
    expect(validate("record-judgment", bound).valid).toBe(true);
    expect(validateVersion("record-judgment", bound, "0.3.0").valid).toBe(true);
    expect(validateContract(REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID, bound).valid).toBe(true);
    expect(validateContract(SCHEMA_IDS["record-judgment"], bound).valid).toBe(false);
    expect(validate("record-judgment", { ...bound, schema_version: "0.2.0" }).valid).toBe(false);
    expect(validateVersion("record-judgment", bound, "0.2.0").valid).toBe(false);
    expect(resolveSchemaVersion("record-judgment", "0.2.0")?.schemaId).toBe(
      SCHEMA_IDS["record-judgment"],
    );
    expect(resolveSchemaVersion("record-judgment", "0.3.0")?.schemaId).toBe(
      REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID,
    );
  });

  test("new vendored and embedded contract matches its separate authority", () => {
    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL("../../../schemas/analysis/record-judgment-v0.3.schema.json", import.meta.url),
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const vendored = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../schemas/record-judgment-v0.3.schema.json", import.meta.url)),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(vendored).toEqual(schema);
    expect(RAW_REVIEW_ARTIFACT_JUDGMENT_SCHEMA).toEqual(schema);
  });

  test("requires a singular closed association with separate locator and identity", () => {
    for (const value of [
      [],
      [binding],
      [binding, { ...binding, content_hash: `sha256:${"b".repeat(64)}` }],
      {},
      { path: binding.path },
      { content_hash: binding.content_hash },
      { ...binding, reviewer: "someone" },
      { ...binding, accepted: true },
    ]) {
      expect(validate("record-judgment", { ...bound, review_artifact: value }).valid).toBe(false);
    }
  });

  test("rejects malformed hashes and ambiguous path syntax before filesystem access", () => {
    for (const hash of [
      "",
      "sha256:",
      `SHA256:${"a".repeat(64)}`,
      `sha256:${"A".repeat(64)}`,
      `sha256:${"a".repeat(63)}`,
      `sha512:${"a".repeat(64)}`,
      `${binding.content_hash}\n`,
    ]) {
      expect(
        validate("record-judgment", {
          ...bound,
          review_artifact: { ...binding, content_hash: hash },
        }).valid,
        JSON.stringify(hash),
      ).toBe(false);
    }
    for (const path of [
      "",
      "/docs/review.yaml",
      ".",
      "..",
      "docs/../review.yaml",
      "docs/./review.yaml",
      "docs//review.yaml",
      "docs/review.yaml/",
      "docs\\review.yaml",
      "C:/docs/review.yaml",
      "docs/%2e%2e/review.yaml",
      "docs/review.yaml\0",
      "docs/review.yaml\n",
      "docs/review.yaml\u007f",
      "docs/review\ud800.yaml",
      "docs/\u2028/../evil",
      "docs/\u2029/../evil",
    ]) {
      expect(
        validate("record-judgment", {
          ...bound,
          review_artifact: { ...binding, path },
        }).valid,
        JSON.stringify(path),
      ).toBe(false);
    }
  });

  test("canonical locators preserve well-formed Unicode without normalization", () => {
    expect(
      validate("record-judgment", {
        ...bound,
        review_artifact: { ...binding, path: "docs/review-📚.yaml" },
      }).valid,
    ).toBe(true);
  });

  test("binding leaves status, reviewer, evidence, and truth dimensions independent", () => {
    for (const status of ["proposed", "contested", "accepted"]) {
      expect(validate("record-judgment", { ...bound, status, value: false }).valid).toBe(true);
    }
    expect(
      validate("record-judgment", {
        ...bound,
        status: "proposed",
        supersedes_judgment_ids: ["older"],
      }).valid,
    ).toBe(false);
  });

  test("cross-version successors preserve history and reject contradictory lineage", () => {
    const older: CurrentRecordJudgment = { ...base, schema_version: "0.2.0", status: "accepted" };
    const historical: CurrentRecordJudgment = {
      ...older,
      status: "superseded",
      superseded_by_judgment_id: "review_bound",
    };
    const newer: CurrentRecordJudgment = {
      ...bound,
      schema_version: "0.3.0",
      judgment_id: "review_bound",
      status: "accepted",
      supersedes_judgment_ids: [older.judgment_id],
    };
    expect(older.status).toBe("accepted");
    expect(older).not.toHaveProperty("review_artifact");
    expect(validateJudgmentSupersession([historical, newer]).valid).toBe(true);
    expect(
      validateJudgmentSupersession([
        historical,
        {
          ...newer,
          supersedes_judgment_ids: [newer.judgment_id],
        },
      ]).issues.map(({ code }) => code),
    ).toContain("SELF_SUPERSESSION");
    const next = { ...newer, judgment_id: "competing" };
    expect(
      validateJudgmentSupersession([historical, newer, next]).issues.map(({ code }) => code),
    ).toContain("DISAGREEING_DIRECTION");
    expect(
      validateJudgmentSupersession([historical, { ...newer, status: "proposed" }]).issues.map(
        ({ code }) => code,
      ),
    ).toContain("SUPERSEDES_REQUIRES_ACCEPTED");
    expect(
      validateJudgmentSupersession([
        { ...historical, supersedes_judgment_ids: [newer.judgment_id] },
        { ...newer, status: "superseded", superseded_by_judgment_id: historical.judgment_id },
      ]).issues.map(({ code }) => code),
    ).toContain("SUPERSESSION_CYCLE");
  });
});
