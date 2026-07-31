/**
 * The reviewed EU–US AI evaluation corpus, as the web app reads it.
 *
 * The page that rendered this data was removed and will be rebuilt; these tests
 * cover the data layer that survives it, so the reviewed distinctions cannot
 * rot while there is no interface exercising them.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  policyTestDataset,
  policyTestEvidenceEntries,
  policyTestEvidenceGroups,
  policyTestHighlights,
  policyTestReceipt,
  policyTestRuleConditions,
  policyTestSummary,
  policyTestUsSubResults,
} from "../lib/policy-test";
import { humanize } from "../lib/policy-test-format";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

const dataset = policyTestDataset();
const entries = policyTestEvidenceEntries();

/** The fields these tests assert on, as recorded in the reviewed YAML. */
interface ReviewedClaimFields {
  actor_type?: string;
  conduct_type?: string;
  conduct_family?: string;
  legal_force?: string;
  applicability_status?: string;
  enforcement_status?: string;
  binding_scope?: string;
  target_system?: string;
  headline_relevance?: string;
  effective_from?: string;
  compliance_deadline?: string;
}

const claim = (id: string): ReviewedClaimFields => {
  for (const record of dataset.records) {
    if (record.row_id === id) return record;
    for (const child of record.derived_claims ?? []) {
      if (child.claim_id === id) return child;
    }
  }
  throw new Error(`no reviewed claim ${id}`);
};

describe("reviewed corpus shape", () => {
  test("24 parent rows and 32 normalized claims, counted from the data", () => {
    const summary = policyTestSummary();
    expect(summary.parentRowCount).toBe(24);
    expect(summary.euParentRowCount).toBe(12);
    expect(summary.usParentRowCount).toBe(12);
    expect(summary.normalizedClaimCount).toBe(32);
    expect(summary.pendingReviewCount).toBe(0);
    expect(summary.rejectedReviewCount).toBe(0);

    const expectations = dataset.validation_expectations;
    expect(summary.parentRowCount).toBe(expectations.parent_row_count);
    expect(summary.normalizedClaimCount).toBe(expectations.normalized_claim_count);
  });

  test("every reviewed row is accepted", () => {
    expect(dataset.records.every((record) => record.review_decision === "accepted")).toBe(true);
  });

  test("source bundles keep their child claims underneath them", () => {
    const bundles = policyTestEvidenceGroups().filter((group) => group.isBundle);
    expect(
      Object.fromEntries(bundles.map((group) => [group.parent.id, group.children.length])),
    ).toEqual({ "EU-10": 3, "EU-11": 2, "US-05": 2, "US-08": 2, "US-09": 3, "US-10": 2 });

    for (const group of bundles) {
      for (const child of group.children) {
        expect(child.parentRowId).toBe(group.parent.id);
        expect(child.kind).toBe("derived_claim");
        expect(child.id.startsWith(group.parent.id)).toBe(true);
      }
    }
    expect(policyTestEvidenceGroups()).toHaveLength(24);
    expect(entries).toHaveLength(38); // 24 parents + 14 derived claims
  });

  test("the rule conditions come from methodology.headline_rule", () => {
    const rule = dataset.methodology.headline_rule;
    expect(policyTestRuleConditions()).toEqual([
      { label: "Actor", value: "Market provider", source: "actor_type", key: "actor" },
      { label: "Conduct", value: "Model evaluation", source: "conduct_type", key: "conduct" },
      { label: "Legal force", value: "Binding", source: "legal_force", key: "force" },
      {
        label: "Applicability",
        value: "Applicable",
        source: "applicability_status",
        key: "applicability",
      },
      // `target_class` names the class of model, not a per-claim field, so it
      // is part of the rule but is never used as a filter.
      {
        label: "Target class",
        value: "Advanced or general-purpose AI model",
        source: "target_class",
        key: null,
      },
    ]);
    expect(rule.actor_type).toBe("market_provider");
    expect(rule.conduct_type).toBe("model_evaluation");
  });
});

describe("the reviewed distinctions survive", () => {
  test("EU-06 is the decisive evidence and the only claim satisfying the rule", () => {
    const receipt = policyTestReceipt();
    expect(receipt.eu.decisiveEvidence).toEqual(["EU-06"]);

    const eu06 = claim("EU-06");
    expect(eu06.actor_type).toBe("market_provider");
    expect(eu06.conduct_type).toBe("model_evaluation");
    expect(eu06.legal_force).toBe("binding");
    expect(eu06.applicability_status).toBe("applicable");
    expect(eu06.target_system).toBe("general_purpose_ai_model_with_systemic_risk");

    // The positive finding never generalizes past the class EU-06 names.
    expect(receipt.eu.definedClass).toBe(
      "provider of a general-purpose AI model with systemic risk",
    );
  });

  test("EU-01 stays supporting only: documentation is not model evaluation", () => {
    const eu01 = claim("EU-01");
    expect(eu01.conduct_type).toBe("evaluation_documentation");
    expect(eu01.conduct_type).not.toBe("model_evaluation");
    expect(eu01.headline_relevance).toBe("supporting_only");
    expect(policyTestReceipt().eu.supportingEvidence).toContain("EU-01");
    expect(policyTestReceipt().eu.decisiveEvidence).not.toContain("EU-01");

    const highlight = policyTestHighlights().find((item) => item.id === "EU-01");
    expect(highlight?.summary).toBe(
      "Market provider · Evaluation documentation · Binding · Applicable",
    );
  });

  test("US-03 stays voluntary: evaluation guidance is not a binding duty", () => {
    const us03 = claim("US-03");
    expect(us03.conduct_type).toBe("model_evaluation");
    expect(us03.legal_force).toBe("voluntary");
    expect(us03.actor_type).toBe("ai_lifecycle_organization");
    expect(us03.actor_type).not.toBe("market_provider");
    expect(policyTestReceipt().eu.decisiveEvidence).not.toContain("US-03");
  });

  test("US-08A stays government-only binding and never a market duty", () => {
    const us08a = claim("US-08A");
    expect(us08a.legal_force).toBe("binding");
    expect(us08a.actor_type).toBe("federal_agency");
    expect(us08a.binding_scope).toBe("federal_agencies_only");
    // Pre-deployment testing carries an evaluation *family*, not the conduct type.
    expect(us08a.conduct_type).toBe("pre_deployment_testing");
    expect(us08a.conduct_family).toBe("evaluation");
    expect(us08a.conduct_type).not.toBe("model_evaluation");
  });

  test("no US claim places a duty on a market provider", () => {
    expect(
      entries.filter((item) => item.jurisdiction === "US" && item.actorType === "market_provider"),
    ).toEqual([]);
  });

  test("each claim's rule checks match what it records", () => {
    for (const entry of entries) {
      if (!entry.checks) continue;
      const byKey = Object.fromEntries(entry.checks.map((check) => [check.key, check.met]));
      expect(byKey.actor).toBe(entry.actorType === "market_provider");
      expect(byKey.conduct).toBe(entry.conductType === "model_evaluation");
      expect(byKey.force).toBe(entry.legalForce === "binding");
    }
    // Exactly one claim meets all four conditions.
    const all = entries.filter((entry) => entry.checks?.every((check) => check.met));
    expect(all.map((entry) => entry.id)).toEqual(["EU-06"]);
  });
});

describe("headline judgments", () => {
  test("both judgments match the reviewed YAML exactly", () => {
    const receipt = policyTestReceipt();
    const stated = dataset.headline_judgments;

    expect(receipt.eu.status).toBe(stated.EU.market_provider);
    expect(receipt.eu.status).toBe("binding_applicable_for_defined_class");
    expect(receipt.eu.decisiveEvidence).toEqual(stated.EU.decisive_evidence);
    expect(receipt.eu.supportingEvidence).toEqual(stated.EU.supporting_evidence);
    expect(receipt.eu.supportingEvidence).toEqual(["EU-01", "EU-02", "EU-07", "EU-10B", "EU-11A"]);

    expect(receipt.us.status).toBe(stated.US.market_provider_cross_sector);
    expect(receipt.us.status).toBe("no_current_binding_model_evaluation_requirement");
  });

  test("the transition qualification is read from the EU-11 lifecycle claims", () => {
    const receipt = policyTestReceipt();
    expect(receipt.eu.transitionFrom).toBe(claim("EU-11A").effective_from ?? null);
    expect(receipt.eu.transitionDeadline).toBe(claim("EU-11B").compliance_deadline ?? null);
    expect(receipt.eu.transitionFrom).toBe("2025-08-02");
    expect(receipt.eu.transitionDeadline).toBe("2027-08-02");
  });

  test("the four US sub-results stay separate, each with its own evidence", () => {
    const subResults = policyTestUsSubResults();
    expect(subResults.map((result) => result.key)).toEqual([
      "government_use",
      "government_procurement",
      "voluntary_cross_sector",
      "proposed_future",
    ]);

    const byKey = Object.fromEntries(subResults.map((result) => [result.key, result.evidence]));
    expect(byKey.government_use).toEqual(["US-07", "US-08A", "US-08B"]);
    expect(byKey.government_procurement).toEqual([
      "US-09A",
      "US-09B",
      "US-09C",
      "US-10A",
      "US-10B",
    ]);
    expect(byKey.voluntary_cross_sector).toEqual([
      "US-01",
      "US-02",
      "US-03",
      "US-04",
      "US-05A",
      "US-05B",
    ]);
    expect(byKey.proposed_future).toEqual(["US-11"]);

    for (const result of subResults) expect(result.evidence.length).toBeGreaterThan(0);
  });

  test("contract-mediated vendor duties are not agency duties", () => {
    for (const id of ["US-09C", "US-10A", "US-10B"]) {
      const record = claim(id);
      expect(record.legal_force).toBe("contractual");
      expect(record.actor_type).toBe("government_vendor");
      expect(record.binding_scope).toBe("government_contract_only");
      expect(record.applicability_status).toBe("contingent_on_contract");
    }
  });

  test("the receipt is content-hashed with the repository's convention", () => {
    expect(policyTestReceipt().contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("unknown is preserved", () => {
  test("every reviewed unknown survives into the view model", () => {
    const inSource = new Set<string>();
    for (const record of dataset.records) {
      if (record.enforcement_status === "unknown") inSource.add(record.row_id);
      for (const child of record.derived_claims ?? []) {
        if (child.enforcement_status === "unknown") inSource.add(child.claim_id);
      }
    }
    expect(inSource.size).toBe(12);

    const inView = new Set(
      entries
        .filter((item) =>
          item.fields.some(
            (field) => field.label === "Enforcement status" && field.value === "unknown",
          ),
        )
        .map((item) => item.id),
    );
    expect(inView).toEqual(inSource);
  });

  test("an absent value is distinct from a recorded unknown", () => {
    const eu06 = entries.find((item) => item.id === "EU-06");
    const enforcement = eu06?.fields.find((field) => field.label === "Enforcement status");
    expect(enforcement?.value).toBe("unknown");
    expect(enforcement?.tone).toBe("unknown");
    // A field the reviewers left off is `null`, never the string "unknown".
    const absent = entries.flatMap((item) => item.fields).filter((field) => field.value === null);
    expect(absent.every((field) => field.tone === "default")).toBe(true);
  });

  test("humanize never dresses unknown up as prose", () => {
    expect(humanize("unknown")).toBe("unknown");
    expect(humanize("not_applicable")).toBe("Not applicable");
  });
});

describe("data provenance", () => {
  test("the generated projection is built from the authoritative YAML", () => {
    const script = read("scripts/embed-policy-test.ts");
    expect(script).toContain(
      "archive/pilots/eu-us-ai-evaluation-v1/original/annotations/human-reviewed.yaml",
    );
    expect(script).toContain("Bun.YAML.parse");
    expect(script).toContain("requireFields");

    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toContain("embed-policy-test.ts");
    expect(pkg.scripts.embed).toContain("embed-policy-test.ts");
  });

  test("the projection agrees with the reviewed YAML on disk", () => {
    const yaml = readFileSync(
      resolve(
        WEB_ROOT,
        "../../archive/pilots/eu-us-ai-evaluation-v1/original/annotations/human-reviewed.yaml",
      ),
      "utf8",
    );
    const source = Bun.YAML.parse(yaml) as { records: unknown[]; dataset_id: string };
    expect(source.dataset_id).toBe(dataset.dataset_id);
    expect(source.records).toHaveLength(dataset.records.length);
  });

  test("no runtime network request fetches the dataset", () => {
    for (const file of ["lib/policy-test.ts", "lib/policy-test-format.ts"]) {
      expect(read(file)).not.toContain("fetch(");
    }
  });
});
