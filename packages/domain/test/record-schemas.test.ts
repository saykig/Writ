import { describe, expect, test } from "bun:test";
import { UnsupportedSchemaVersionError, validate, validateVersion } from "../src/index.js";

const hash = `sha256:${"a".repeat(64)}`;
const base = {
  schema_version: "0.1.0",
  record_id: "record.us.example",
  corpus_id: "corpus.us.example",
  record_version: "0.1.0",
  family: "legal_policy",
  title: "Example record",
  subjects: [
    {
      subject_id: "united_states",
      subject_type: "jurisdiction",
      label: "United States",
      role: "governing jurisdiction",
    },
  ],
  assertion: { mode: "states", text: "The source states an example proposition." },
  topics: [],
  scope: {
    jurisdictions: ["United States"],
    institutional_scope: [],
    temporal_scope: {},
    conditions: [],
  },
  evidence: [
    {
      source_id: "source.example",
      document_version_id: "source.example.v1",
      passage_id: "source.example.p1",
      locator: "section 1",
      quote: "Exact source passage.",
      passage_hash: hash,
      document_hash: hash,
      basis: "direct",
    },
  ],
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
  subjects: [{ subject_id: "nist", subject_type: "institution" }],
  institution_id: "nist",
  institution_type: "federal_agency",
  mandate: { status: "unknown" },
  mission: {
    text: "A source-reported mission statement.",
    source_ids: ["source.example"],
    evidence_refs: ["source.example.p1"],
  },
  jurisdictions: ["United States"],
  functions: ["measurement_science"],
  operational_capacity: { status: "unknown", dimensions: [], evidence_refs: [] },
} as const;

const atomicFunction = {
  ...base,
  schema_version: "0.2.0",
  record_id: "record.eu.ai-office.function",
  record_version: "0.2.0",
  family: "institutional",
  institution_id: "eu_ai_office",
  institutional_fact_type: "function",
  function: "serious_incident_report_receipt",
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
  test("future family identifiers are accepted by the base", () => {
    expect(validate("record", { ...base, family: "theoretical" }).valid).toBe(true);
    expect(validate("record", { ...base, family: "future_family_2" }).valid).toBe(true);
  });
  test("missing evidence fails", () =>
    expect(validate("record", { ...base, evidence: [] }).valid).toBe(false));
  test("missing identity fails", () => {
    const { record_id: _, ...missing } = base;
    expect(validate("record", missing).valid).toBe(false);
  });
  test("empty subjects fail", () =>
    expect(validate("record", { ...base, subjects: [] }).valid).toBe(false));
  test("explicit uncertainty and an empty uncertainty array both pass", () => {
    expect(validate("record", base).valid).toBe(true);
    expect(
      validate("record", {
        ...base,
        uncertainties: [{ type: "unknown", description: "Not established." }],
      }).valid,
    ).toBe(true);
  });
  test("unsupported and family-specific properties fail", () => {
    expect(validate("record", { ...base, arbitrary: true }).valid).toBe(false);
    expect(validate("record", { ...base, instrument_type: "constitution" }).valid).toBe(false);
  });
  test("subjects and expanded scope remain structurally strict", () => {
    expect(
      validate("record", {
        ...base,
        subjects: [{ subject_id: "united_states", subject_type: "jurisdiction", extra: true }],
      }).valid,
    ).toBe(false);
    expect(
      validate("record", {
        ...base,
        scope: { ...base.scope, unexpected: true },
      }).valid,
    ).toBe(false);
  });
});

describe("legal-policy record schema", () => {
  test("constitutional and AI-policy records pass", () => {
    expect(validate("legal-policy-record", legal).valid).toBe(true);
    expect(
      validate("legal-policy-record", {
        ...legal,
        topics: ["artificial_intelligence"],
        instrument_type: "agency_policy",
      }).valid,
    ).toBe(true);
  });
  test("wrong family and missing instrument type fail", () => {
    expect(validate("legal-policy-record", { ...legal, family: "institutional" }).valid).toBe(
      false,
    );
    const { instrument_type: _, ...missing } = legal;
    expect(validate("legal-policy-record", missing).valid).toBe(false);
  });
  test("the extension inherits required base fields without redeclaring them", () => {
    const { scope: _, ...missingBaseScope } = legal;
    expect(validate("legal-policy-record", missingBaseScope).valid).toBe(false);
  });
  test("force, adoption, applicability, and enforcement remain independent", () => {
    expect(
      validate("legal-policy-record", {
        ...legal,
        force: "voluntary",
        adoption_status: "proposed",
        applicability_status: "government_use",
        enforcement_status: "none_specified",
      }).valid,
    ).toBe(true);
  });
  test("draft imports preserve explicit unknowns", () =>
    expect(validate("legal-policy-record", legal).valid).toBe(true));
});

describe("institutional record schema", () => {
  test("explicit version validation rejects unsupported versions instead of using current", () => {
    expect(validateVersion("institutional-record", atomicFunction, "0.2.0").valid).toBe(true);
    for (const version of ["", "0.2.1", "9.9.9"]) {
      expect(() => validateVersion("institutional-record", atomicFunction, version)).toThrow(
        UnsupportedSchemaVersionError,
      );
    }
  });

  test("valid NIST-shaped record with unknown capacity passes", () =>
    expect(validate("institutional-record", institutional).valid).toBe(true));
  test("the extension constrains family and inherits the base contract", () => {
    expect(
      validate("institutional-record", { ...institutional, family: "legal_policy" }).valid,
    ).toBe(false);
    const { mandate: _, ...missingMandate } = institutional;
    expect(validate("institutional-record", missingMandate).valid).toBe(false);
    const { subjects: __, ...missingSubjects } = institutional;
    expect(validate("institutional-record", missingSubjects).valid).toBe(false);
  });
  test("unknown mandate status is valid for identity, placement, relationship, and function records", () => {
    for (const mode of ["defines", "states", "assigns", "performs"] as const) {
      expect(
        validate("institutional-record", {
          ...institutional,
          assertion: { mode, text: `A ${mode} assertion.` },
          mandate: { status: "unknown" },
        }).valid,
      ).toBe(true);
    }
  });
  test("mission, mandate, functions, and operational capacity remain independent", () => {
    expect(institutional.mission).toEqual({
      text: "A source-reported mission statement.",
      source_ids: ["source.example"],
      evidence_refs: ["source.example.p1"],
    });
    expect(institutional.mandate).toEqual({ status: "unknown" });
    expect(institutional.operational_capacity.status).toBe("unknown");
    expect(institutional.functions).toEqual(["measurement_science"]);
    expect(validate("legal-policy-record", institutional).valid).toBe(false);
  });
  test("unknown fields are rejected after base and extension composition", () => {
    expect(validate("institutional-record", { ...institutional, authority: true }).valid).toBe(
      false,
    );
  });
  test("v0.2 identity and placement facts require only their own payload", () => {
    const common = { ...atomicFunction } as Record<string, unknown>;
    delete common.function;
    expect(
      validate("institutional-record", {
        ...common,
        institutional_fact_type: "identity",
        institution_type: "organizational_unit",
      }).valid,
    ).toBe(true);
    expect(
      validate("institutional-record", {
        ...common,
        institutional_fact_type: "placement",
        parent_institution_id: "european_commission",
      }).valid,
    ).toBe(true);
  });
  test("function does not imply or permit mandate or operational capacity", () => {
    expect(validate("institutional-record", atomicFunction).valid).toBe(true);
    expect(
      validate("institutional-record", {
        ...atomicFunction,
        mandate: { status: "established" },
      }).valid,
    ).toBe(false);
    expect(
      validate("institutional-record", {
        ...atomicFunction,
        operational_capacity: { status: "established", dimensions: [], evidence_refs: [] },
      }).valid,
    ).toBe(false);
  });
});

describe("record judgment schema", () => {
  test("valid and contested judgments pass", () =>
    expect(validate("record-judgment", judgment).valid).toBe(true));
  test("missing target, rationale, or evidence fails", () => {
    const { target_record_id: _, ...missingTarget } = judgment;
    const { rationale: __, ...missingRationale } = judgment;
    expect(validate("record-judgment", missingTarget).valid).toBe(false);
    expect(validate("record-judgment", missingRationale).valid).toBe(false);
    expect(validate("record-judgment", { ...judgment, evidence_refs: [] }).valid).toBe(false);
  });
  test("supersession is traceable and approved is rejected", () => {
    expect(
      validate("record-judgment", {
        ...judgment,
        status: "superseded",
        supersedes: "judgment.earlier",
      }).valid,
    ).toBe(true);
    expect(validate("record-judgment", { ...judgment, status: "superseded" }).valid).toBe(false);
    expect(validate("record-judgment", { ...judgment, status: "approved" }).valid).toBe(false);
  });
});

describe("record links and current judgments", () => {
  test("a family-neutral link has independent review state", () => {
    expect(
      validate("record-link", {
        schema_version: "1.0.0",
        link_id: "link.example",
        owning_corpus_id: "corpus.example",
        source_id: "record.example",
        source_kind: "record",
        target_id: "institution.example",
        target_kind: "institution",
        relation_type: "issued_by",
        basis: "direct",
        evidence_refs: ["passage.example"],
        uncertainties: [],
        provenance: { created_by: "test", created_at: "2026-08-04" },
        review_state: "draft",
      }).valid,
    ).toBe(true);
  });
  test("v0.2 judgments target records or record links without changing workflow state", () => {
    for (const target_kind of ["record", "record_link"] as const) {
      expect(
        validate("record-judgment", {
          schema_version: "0.2.0",
          judgment_id: `judgment.${target_kind}`,
          target_kind,
          target_id: "target.example",
          judgment_type: "disagreement",
          value: "unknown",
          rationale: "Independent review rationale.",
          evidence_refs: ["passage.example"],
          reviewer: "test-reviewer",
          status: "proposed",
          created_at: "2026-08-04",
        }).valid,
      ).toBe(true);
    }
  });
});
