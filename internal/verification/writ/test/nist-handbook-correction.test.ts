import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AtomicInstitutionalRecord, CurrentRecordJudgment } from "@writ/domain";
import { validateJudgmentSupersession } from "@writ/domain";

import {
  buildLogicalPassageIndex,
  loadRepository,
  repositoryRoot,
  resolveRoutedSource,
} from "../src/index.js";

const ROOT = repositoryRoot(import.meta.dir);
const snapshot = loadRepository(ROOT).snapshot;
const CORPUS = "us.institutions.nist";
const OLD_RECORD = "nist_nvlap_lab_decision_right";
const NEW_RECORD = "nist_nvlap_lab_decision_right_v2";
const OLD_JUDGMENT = "judgment_nist_nvlap_lab_decision_right_stage_b";
const NEW_JUDGMENT = "judgment_nist_nvlap_lab_decision_right_v2_human_review";
const LINK = "nist_nvlap_lab_decision_right_v2_supersedes_nist_nvlap_lab_decision_right";
const LINK_JUDGMENT = "judgment_nist_nvlap_lab_decision_right_v2_supersession_human_review";
const SOURCE = "nist.handbook_150";
const VERSION = "nist.handbook_150.v2020_update_1";
const DOCUMENT_HASH = "sha256:7105b9f201a580599b1871fcb7dd9cb5c09b0dcc46bb7e9bd654a960cae65f7e";
const OLD_PASSAGES = ["nist.handbook_150.competence", "nist.handbook_150.accreditation_decision"];
const NEW_PASSAGES: [string, string] = [
  "nist.handbook_150.competence_clause_1_3_5",
  "nist.handbook_150.accreditation_decision_clause_3_5_3_sentence_1",
];
const REVIEWER = "Writ maintainer (explicit human disposition)";
const REVIEW_PATH = "docs/migrations/nist-handbook-competence/human-review.yaml";
const COMPETENCE_QUOTE =
  "NVLAP accreditation is based on evaluation of a laboratory’s management and technical competence for conducting specific tests or calibrations. Accreditation is granted only after thorough evaluation of an applicant has demonstrated that all NVLAP requirements have been fulfilled. Fulfillment of requirements is acknowledged by the issuance of a Certificate of Accreditation and a Scope of Accreditation, which details the specific test methods, calibration parameters, or services for which a laboratory has been accredited.";
const DECISION_QUOTE =
  "Based on this evaluation, NVLAP makes the decision whether or not to accredit the laboratory.";
type DecisionRightRecord = Extract<
  AtomicInstitutionalRecord,
  { institutional_fact_type: "decision_right" }
>;
const before = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures/nist-handbook-before-correction.json"), "utf8"),
) as {
  captured_from_commit: string;
  record: DecisionRightRecord;
  judgment: CurrentRecordJudgment;
  source: Record<string, unknown>;
};

function record(id: string): DecisionRightRecord {
  const matches = snapshot.institutionalRecords.filter(
    (item) => item.corpus_id === CORPUS && item.value.record_id === id,
  );
  expect(matches).toHaveLength(1);
  const value = matches[0]!.value;
  if (value.institutional_fact_type !== "decision_right")
    throw new Error(`${id} must remain a decision-right record`);
  return value;
}

function judgment(id: string): CurrentRecordJudgment {
  const matches = snapshot.judgments.filter(
    (item) => item.corpus_id === CORPUS && item.value.judgment_id === id,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!.value;
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value !== null && typeof value === "object")
    return Object.values(value).flatMap(stringValues);
  return [];
}

describe("human-approved Handbook evidence correction", () => {
  test("preserves the entire earlier record and approval apart from explicit retirement metadata", () => {
    expect(before.captured_from_commit).toBe("9a20df062fb6065dec8ce0ec83cd2dd1eb3339d1");
    expect(record(OLD_RECORD)).toEqual({ ...before.record, review_state: "superseded" });
    expect(judgment(OLD_JUDGMENT)).toEqual({
      ...before.judgment,
      status: "superseded",
      superseded_by_judgment_id: NEW_JUDGMENT,
    });
    expect(judgment(OLD_JUDGMENT).reviewer).toBe("Sara Kim");
    expect(before.record.evidence[1]!.quote).toContain("based on the evaluation");

    const passages = buildLogicalPassageIndex(snapshot);
    for (const [index, passageId] of OLD_PASSAGES.entries()) {
      const resolved = passages.resolve(passageId);
      expect(resolved.status).toBe("resolved");
      expect(resolved.occurrences.map((item) => item.objectId)).toEqual([OLD_RECORD]);
      expect(resolved.occurrences[0]!.aliases).toEqual([]);
      expect(resolved.occurrences[0]!.signature.quote).toBe(
        before.record.evidence[index + 1]!.quote,
      );
      expect(resolved.occurrences[0]!.signature.passage_hash).toBe(
        before.record.evidence[index + 1]!.passage_hash,
      );
    }
  });

  test("preserves the scoped substantive assertion and source version while replacing only reviewed evidence", () => {
    const current = record(NEW_RECORD);
    expect(current.record_version).toBe("0.2.1");
    expect(current.review_state).toBe("approved");
    expect(current.provenance).toEqual({
      created_by: "OpenAI Codex implementation of explicit human disposition",
      created_at: "2026-09-04",
    });
    // Restore only the deliberately changed revision/evidence fields. Everything
    // else, including uncertainty, authority, scope and assertion, must match t1.
    const historicalComparable: DecisionRightRecord = {
      ...current,
      record_id: before.record.record_id,
      record_version: before.record.record_version,
      evidence: before.record.evidence,
      provenance: before.record.provenance,
      review_state: before.record.review_state,
      decision_right: {
        ...current.decision_right,
        evidence_refs: before.record.decision_right.evidence_refs!,
      },
    };
    expect(historicalComparable).toEqual(before.record);
    expect(current.evidence[0]).toEqual(before.record.evidence[0]);
    expect(current.decision_right?.evidence_refs).toEqual([
      before.record.evidence[0]!.passage_id,
      ...NEW_PASSAGES,
    ]);
    const source = resolveRoutedSource(snapshot, CORPUS, SOURCE);
    expect(source.status).toBe("resolved");
    if (source.status !== "resolved") throw new Error("Handbook source must resolve");
    expect(source.source.value).toEqual(before.source);
    const frozenPdf = readFileSync(
      join(
        ROOT,
        "corpora/institutional/us/nist/sources/captures/nist-handbook-150-2020-update-1.pdf",
      ),
    );
    expect(`sha256:${createHash("sha256").update(frozenPdf).digest("hex")}`).toBe(DOCUMENT_HASH);
  });

  test("binds each new passage identity to its exact approved extent, UTF-8 quote and hash", () => {
    const expected = [
      {
        passage_id: NEW_PASSAGES[0],
        locator:
          "NIST Handbook 150:2020 update 1; PDF page 10 (printed page 2); clause 1.3.5; complete clause body (three sentences), excluding clause number; extraction profile track-b-pdf-clause-ascii-whitespace-v1 (pdfplumber 0.11.9); PDF line wraps joined with U+0020",
        quote: COMPETENCE_QUOTE,
        passage_hash: "sha256:2e70cc37b645dc6d9004f7b831c7188c9b1b8cdb1da751706e29677f5f78b4a6",
      },
      {
        passage_id: NEW_PASSAGES[1],
        locator:
          "NIST Handbook 150:2020 update 1; physical PDF page 26 (printed page 18); clause 3.5.3; sentence 1 only, excluding clause number; excludes remainder on nonconformities and the appeal NOTE; extraction profile track-b-pdf-clause-ascii-whitespace-v1 (pdfplumber 0.11.9)",
        quote: DECISION_QUOTE,
        passage_hash: "sha256:cc833bd19e3e1ba753395046a518a87828e00834e22bb72e2e7146dfa79e6ba1",
      },
    ];
    expect(record(NEW_RECORD).evidence.slice(1)).toEqual(
      expected.map((passage) => ({
        ...passage,
        source_id: SOURCE,
        document_version_id: VERSION,
        document_hash: DOCUMENT_HASH,
        basis: "direct",
      })),
    );
    const extraction = JSON.parse(
      readFileSync(join(ROOT, "docs/migrations/nist-handbook-competence/extraction.json"), "utf8"),
    ) as {
      passages: Array<{
        passage_id: string;
        quote: string;
        utf8_hex: string;
        passage_hash: string;
      }>;
    };
    const passages = buildLogicalPassageIndex(snapshot);
    for (const passage of expected) {
      const bytes = Buffer.from(passage.quote, "utf8");
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(
        passage.passage_hash,
      );
      expect(
        extraction.passages.find((item) => item.passage_id === passage.passage_id),
      ).toMatchObject({
        quote: passage.quote,
        utf8_hex: bytes.toString("hex"),
        passage_hash: passage.passage_hash,
      });
      const resolved = passages.resolve(passage.passage_id!);
      expect(resolved.status).toBe("resolved");
      expect(resolved.occurrences.map((item) => item.objectId)).toEqual([NEW_RECORD]);
      expect(resolved.occurrences[0]!.aliases).toEqual([]);
    }
    expect(record(NEW_RECORD).evidence[2]!.quote).toBe(before.record.evidence[2]!.quote);
    expect(record(NEW_RECORD).evidence[2]!.passage_hash).toBe(
      before.record.evidence[2]!.passage_hash,
    );
  });

  test("records the human decision through reciprocal approval lineage and a separately approved directed link", () => {
    const review = Bun.YAML.parse(readFileSync(join(ROOT, REVIEW_PATH), "utf8"));
    expect(review).toMatchObject({
      review_id: "nist-handbook-competence-human-review-2026-09-04",
      reviewer: REVIEWER,
      review_type: "human",
      review_date: "2026-09-04",
      status: "complete",
      record_disposition: {
        historical_record_id: OLD_RECORD,
        approved_successor_id: NEW_RECORD,
        substantive_assertion_unchanged: true,
        historical_judgment_id: OLD_JUDGMENT,
        accepted_successor_judgment_id: NEW_JUDGMENT,
        supersession_link_id: LINK,
        accepted_link_judgment_id: LINK_JUDGMENT,
      },
    });
    expect(judgment(NEW_JUDGMENT)).toMatchObject({
      target_kind: "record",
      target_id: NEW_RECORD,
      judgment_type: "review_disposition",
      value: "approved",
      evidence_refs: record(NEW_RECORD).evidence.map((item) => item.passage_id),
      reviewer: REVIEWER,
      status: "accepted",
      created_at: "2026-09-04",
      supersedes_judgment_ids: [OLD_JUDGMENT],
    });
    expect(judgment(NEW_JUDGMENT).rationale).toContain(REVIEW_PATH);
    const links = snapshot.links.filter(
      (item) => item.value.relation_type === "supersedes" && item.value.target_id === OLD_RECORD,
    );
    expect(links).toHaveLength(1);
    expect(links[0]!.value).toMatchObject({
      link_id: LINK,
      owning_corpus_id: CORPUS,
      source_id: NEW_RECORD,
      source_kind: "record",
      target_id: OLD_RECORD,
      target_kind: "record",
      basis: "direct",
      evidence_refs: NEW_PASSAGES,
      review_state: "approved",
    });
    expect(judgment(LINK_JUDGMENT)).toMatchObject({
      target_kind: "record_link",
      target_id: LINK,
      judgment_type: "record_link_disposition",
      value: "approved",
      evidence_refs: NEW_PASSAGES,
      reviewer: REVIEWER,
      status: "accepted",
      created_at: "2026-09-04",
    });
    expect(judgment(LINK_JUDGMENT)).not.toHaveProperty("supersedes_judgment_ids");
    expect(validateJudgmentSupersession(snapshot.judgments.map((item) => item.value)).valid).toBe(
      true,
    );
  });

  test("has one current successor and no approved consumer of either retired passage identity", () => {
    expect(
      snapshot.records
        .filter(
          (item) =>
            [OLD_RECORD, NEW_RECORD].includes(item.value.record_id) &&
            item.value.review_state === "approved",
        )
        .map((item) => item.value.record_id),
    ).toEqual([NEW_RECORD]);
    expect(
      snapshot.judgments
        .filter((item) => item.value.status === "accepted" && item.value.target_id === OLD_RECORD)
        .map((item) => item.value.judgment_id),
    ).toEqual([]);
    const active = [
      ...snapshot.records.filter((item) => item.value.review_state === "approved"),
      ...snapshot.links.filter((item) => item.value.review_state === "approved"),
      ...snapshot.judgments.filter((item) => item.value.status === "accepted"),
    ];
    for (const item of active) {
      expect(stringValues(item.value).filter((value) => OLD_PASSAGES.includes(value))).toEqual([]);
    }
    for (const { value } of snapshot.links.filter(
      (item) => item.value.review_state === "approved",
    )) {
      expect(value.supporting_record_ids ?? []).not.toContain(OLD_RECORD);
      if (value.link_id !== LINK) {
        expect([value.source_id, value.target_id]).not.toContain(OLD_RECORD);
      }
    }
    for (const { value } of snapshot.records.filter(
      (item) => item.value.review_state === "approved",
    )) {
      for (const evidence of value.evidence) {
        if (evidence.source_id !== SOURCE || evidence.document_version_id !== VERSION) continue;
        // A fresh passage ID must not launder the defective bytes or an old
        // unspecified selector into a different approved record.
        expect(evidence.passage_hash).not.toBe(before.record.evidence[1]!.passage_hash);
        expect(before.record.evidence.slice(1).map((item) => item.locator)).not.toContain(
          evidence.locator,
        );
      }
    }
    expect(snapshot.loadIssues).toEqual([]);
  });
});
