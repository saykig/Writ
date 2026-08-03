import { describe, expect, test } from "bun:test";
import { validate } from "../src/index.js";

const hash = `sha256:${"a".repeat(64)}`;
const base = {
  schema_version: "0.1.0",
  record_id: "record.us.example",
  corpus_id: "corpus.us.example",
  record_version: "0.1.0",
  family: "legal_policy",
  title: "Example record",
  subjects: ["united_states"],
  assertion: { mode: "states", text: "The source states an example proposition." },
  topics: [],
  scope: { jurisdiction: "United States", conditions: [] },
  evidence: [{
    source_id: "source.example",
    document_version_id: "source.example.v1",
    passage_id: "source.example.p1",
    locator: "section 1",
    quote: "Exact source passage.",
    passage_hash: hash,
    document_hash: hash,
    basis: "direct",
  }],
  uncertainties: [],
  provenance: { created_by: "test", created_at: "2026-08-03" },
  review_state: "draft",
} as const;

const legal = {
  ...base,
  instrument_type: "constitution",
  jurisdiction_level: "federal",
  force: "unknown",
  adoption_status: "adopted",
  applicability_status: "unknown",
  enforcement_status: "unknown",
  official_citation: "U.S. Const. art. I",
  provision_identifier: "article-i",
} as const;

const institutional = {
  ...base,
  record_id: "record.us.nist",
  family: "institutional",
  subjects: ["nist"],
  institution_id: "nist",
  institution_type: "federal_agency",
  mandate: "A source-grounded mandate statement.",
  authority_sources: ["source.example"],
  jurisdictions: ["United States"],
  functions: ["measurement_science"],
  operational_capacity: { status: "unknown", dimensions: [], evidence_refs: [] },
} as const;

const judgment = {
  schema_version: "0.1.0",
  judgment_id: "judgment.example",
  target_record_id: legal.record_id,
  judgment_type: "legal_status_determination",
  value: "unknown",
  rationale: "The cited passage does not establish legal force.",
  evidence_refs: ["source.example.p1"],
  reviewer: "test-reviewer",
  status: "contested",
  created_at: "2026-08-03",
} as const;

describe("shared record schema", () => {
  test("valid base record passes", () => expect(validate("record", base).valid).toBe(true));
  test("missing evidence fails", () => expect(validate("record", { ...base, evidence: [] }).valid).toBe(false));
  test("missing identity fails", () => {
    const { record_id: _, ...missing } = base;
    expect(validate("record", missing).valid).toBe(false);
  });
  test("empty subjects fail", () => expect(validate("record", { ...base, subjects: [] }).valid).toBe(false));
  test("explicit uncertainty and an empty uncertainty array both pass", () => {
    expect(validate("record", base).valid).toBe(true);
    expect(validate("record", { ...base, uncertainties: [{ type: "unknown", description: "Not established." }] }).valid).toBe(true);
  });
  test("unsupported and family-specific properties fail", () => {
    expect(validate("record", { ...base, arbitrary: true }).valid).toBe(false);
    expect(validate("record", { ...base, instrument_type: "constitution" }).valid).toBe(false);
  });
});

describe("legal-policy record schema", () => {
  test("constitutional and AI-policy records pass", () => {
    expect(validate("legal-policy-record", legal).valid).toBe(true);
    expect(validate("legal-policy-record", { ...legal, topics: ["artificial_intelligence"], instrument_type: "agency_policy" }).valid).toBe(true);
  });
  test("wrong family and missing instrument type fail", () => {
    expect(validate("legal-policy-record", { ...legal, family: "institutional" }).valid).toBe(false);
    const { instrument_type: _, ...missing } = legal;
    expect(validate("legal-policy-record", missing).valid).toBe(false);
  });
  test("force, adoption, applicability, and enforcement remain independent", () => {
    expect(validate("legal-policy-record", { ...legal, force: "voluntary", adoption_status: "proposed", applicability_status: "government_use", enforcement_status: "none_specified" }).valid).toBe(true);
  });
  test("draft imports preserve explicit unknowns", () => expect(validate("legal-policy-record", legal).valid).toBe(true));
});

describe("institutional record schema", () => {
  test("valid NIST-shaped record with unknown capacity passes", () => expect(validate("institutional-record", institutional).valid).toBe(true));
  test("wrong family, missing mandate, and missing authority fail", () => {
    expect(validate("institutional-record", { ...institutional, family: "legal_policy" }).valid).toBe(false);
    const { mandate: _, ...missingMandate } = institutional;
    expect(validate("institutional-record", missingMandate).valid).toBe(false);
    expect(validate("institutional-record", { ...institutional, authority_sources: [] }).valid).toBe(false);
  });
  test("mandate does not imply capacity or legal-policy validity", () => {
    expect(institutional.operational_capacity.status).toBe("unknown");
    expect(validate("legal-policy-record", institutional).valid).toBe(false);
  });
});

describe("record judgment schema", () => {
  test("valid and contested judgments pass", () => expect(validate("record-judgment", judgment).valid).toBe(true));
  test("missing target, rationale, or evidence fails", () => {
    const { target_record_id: _, ...missingTarget } = judgment;
    const { rationale: __, ...missingRationale } = judgment;
    expect(validate("record-judgment", missingTarget).valid).toBe(false);
    expect(validate("record-judgment", missingRationale).valid).toBe(false);
    expect(validate("record-judgment", { ...judgment, evidence_refs: [] }).valid).toBe(false);
  });
  test("supersession is traceable and approved is rejected", () => {
    expect(validate("record-judgment", { ...judgment, status: "superseded", supersedes: "judgment.earlier" }).valid).toBe(true);
    expect(validate("record-judgment", { ...judgment, status: "superseded" }).valid).toBe(false);
    expect(validate("record-judgment", { ...judgment, status: "approved" }).valid).toBe(false);
  });
});
