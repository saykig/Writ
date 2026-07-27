import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  POLICY_TEST_HREF,
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
import { STAGES } from "../components/policy-test/types";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

const dataset = policyTestDataset();
const entries = policyTestEvidenceEntries();
const entry = (id: string) => {
  const found = entries.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no reviewed record ${id}`);
  return found;
};
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

/** The reviewed record or derived claim behind an ID, straight from the YAML projection. */
const claim = (id: string): ReviewedClaimFields => {
  for (const record of dataset.records) {
    if (record.row_id === id) return record;
    for (const child of record.derived_claims ?? []) {
      if (child.claim_id === id) return child;
    }
  }
  throw new Error(`no reviewed claim ${id}`);
};

// 1. The homepage shows the Policy Test heading and the pilot card.
describe("homepage Policy Test section", () => {
  test("the homepage composes the section without inlining the feature", () => {
    const home = read("app/page.tsx");
    expect(home).toContain("<PolicyTestSection />");
    // The feature must not be written into the homepage file itself.
    expect(home).not.toContain("Reviewed source rows");
    expect(home).not.toContain("<PolicyTestCard");
  });

  test("the section carries the approved heading, subtitle and description", () => {
    const section = read("components/policy-test/policy-test-section.tsx");
    expect(section).toContain(">Policy Test<");
    expect(section).toContain("Run a policy question through Writ.");
    expect(section).toContain(
      "Each test is a reviewed methodology expressed in the DSL. Select one to inspect its rule,",
    );
  });

  test("the pilot card shows the reviewed badge, jurisdiction, question and counts", () => {
    const section = read("components/policy-test/policy-test-section.tsx");
    expect(section).toContain('badge="Human-reviewed pilot"');
    expect(section).toContain('jurisdiction="EU · US federal"');
    expect(section).toContain('question="Is model evaluation legally required?"');
    expect(section).toContain("Tests whether a jurisdiction currently imposes a binding");
    expect(section).toContain('label: "Reviewed source rows"');
    expect(section).toContain('label: "Normalized claims"');
    expect(section).toContain('label: "Review status"');
    expect(section).toContain('action="Open policy test"');
    // Counts are read from the dataset, never typed in by hand.
    expect(section).toContain("String(summary.parentRowCount)");
    expect(section).toContain("String(summary.normalizedClaimCount)");
  });

  test("only reviewed tests appear, with the restraint note beneath the card", () => {
    const section = read("components/policy-test/policy-test-section.tsx");
    expect(section).toContain(
      "Additional tests will appear only after their methodology and evidence have been",
    );
    // Exactly one card: no placeholder or unavailable policy tests.
    expect(section.match(/<PolicyTestCard/g)?.length).toBe(1);
  });

  // 2. The card links to the dedicated route.
  test("the card links to the policy-test route", () => {
    expect(POLICY_TEST_HREF).toBe("/policy-test/eu-us-ai-evaluation");
    expect(read("components/policy-test/policy-test-section.tsx")).toContain(
      "href={POLICY_TEST_HREF}",
    );
    // The route file exists at that path.
    expect(read("app/policy-test/eu-us-ai-evaluation/page.tsx")).toContain(
      "Is model evaluation legally required?",
    );
  });

  test("the whole card is one keyboard-reachable target", () => {
    const card = read("components/policy-test/policy-test-card.tsx");
    // A stretched link makes the card clickable with a single tab stop.
    expect(card).toContain("after:absolute after:inset-0");
    expect(card).toContain("has-[a:focus-visible]:ring-3");
    expect(card).toContain("hover:border-foreground/25");
  });
});

// 3–5. Stages, advance buttons, and the URL query string.
describe("stage navigation", () => {
  test("all four stages are declared in order with their headings", () => {
    expect(STAGES.map((stage) => stage.id)).toEqual(["methodology", "rule", "evidence", "receipt"]);
    expect(STAGES.map((stage) => stage.label)).toEqual([
      "Methodology",
      "Explicit rule",
      "Reviewed evidence",
      "Assessment receipt",
    ]);
    expect(STAGES[0].heading).toBe("Define the question before running it.");
    expect(STAGES[1].heading).toBe("Writ converts the question into a testable condition.");
    expect(STAGES[2].heading).toBe("The rule runs only against accepted, human-reviewed records.");
    expect(STAGES[3].heading).toBe(
      "The result preserves the legal differences between the two systems.",
    );
  });

  test("every stage renders its own panel", () => {
    const workspace = read("components/policy-test/policy-test-workspace.tsx");
    for (const component of [
      "<PolicyTestMethodology",
      "<PolicyTestRule",
      "<PolicyTestEvidence",
      "<PolicyTestReceipt",
    ]) {
      expect(workspace).toContain(component);
    }
  });

  test("each stage's primary button advances to the next stage", () => {
    const workspace = read("components/policy-test/policy-test-workspace.tsx");
    expect(workspace).toContain('onAdvance={() => selectStage("rule")}');
    expect(workspace).toContain('onAdvance={() => selectStage("evidence")}');
    expect(workspace).toContain('onAdvance={() => selectStage("receipt")}');
    // "Inspect reviewed evidence" on the receipt returns to stage 3.
    expect(workspace).toContain('onInspectEvidence={() => selectStage("evidence")}');

    expect(read("components/policy-test/policy-test-methodology.tsx")).toContain(
      "Translate into a rule",
    );
    expect(read("components/policy-test/policy-test-rule.tsx")).toContain(
      "Run against reviewed evidence",
    );
    expect(read("components/policy-test/policy-test-evidence.tsx")).toContain(
      "Produce assessment receipt",
    );
  });

  test("the selected stage is written to and read from the query string", () => {
    const workspace = read("components/policy-test/policy-test-workspace.tsx");
    // Written without a reload, matching the Writ Lab's URL handling.
    expect(workspace).toContain('url.searchParams.set("stage", next)');
    expect(workspace).toContain("window.history.replaceState");

    // Read and validated on the server, so a shared or refreshed URL restores.
    const page = read("app/policy-test/eu-us-ai-evaluation/page.tsx");
    expect(page).toContain("await searchParams");
    expect(page).toContain('isStageId(stage) ? stage : "methodology"');
  });

  test("the stepper is a keyboard-operable tablist", () => {
    const stepper = read("components/policy-test/policy-test-stepper.tsx");
    expect(stepper).toContain('role="tablist"');
    expect(stepper).toContain('role="tab"');
    expect(stepper).toContain("aria-selected={selected}");
    expect(stepper).toContain("aria-controls={panelId}");
    // Roving tabindex: the group is a single tab stop.
    expect(stepper).toContain("tabIndex={selected ? 0 : -1}");
    for (const key of ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"]) {
      expect(stepper).toContain(`"${key}"`);
    }
    // Semantic buttons, not clickable divs.
    expect(stepper).toContain('type="button"');

    const workspace = read("components/policy-test/policy-test-workspace.tsx");
    expect(workspace).toContain('role="tabpanel"');
    expect(workspace).toContain('aria-live="polite"');
  });
});

// 6–9. The four distinctions the pilot turns on.
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
    expect(highlight?.badge).toBe("Supporting only");
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

    const highlight = policyTestHighlights().find((item) => item.id === "US-03");
    expect(highlight?.badge).toBe("Voluntary evaluation");
    expect(highlight?.summary).toBe(
      "AI lifecycle organization · Model evaluation · Voluntary · Applicable",
    );
    // Voluntary guidance never becomes decisive evidence.
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

    const highlight = policyTestHighlights().find((item) => item.id === "US-08A");
    expect(highlight?.badge).toBe("Government-only binding");
    expect(highlight?.summary).toBe(
      "Federal agency · Pre-deployment testing · Binding · Applicable",
    );
  });

  test("no US claim places a duty on a market provider", () => {
    const usMarketProvider = entries.filter(
      (item) => item.jurisdiction === "US" && item.actorType === "market_provider",
    );
    expect(usMarketProvider).toEqual([]);
  });
});

// 10–11. Headline judgments and the separate US sub-results.
describe("headline judgments", () => {
  test("both judgments match the reviewed YAML exactly", () => {
    const receipt = policyTestReceipt();
    const stated = dataset.headline_judgments;

    expect(receipt.eu.status).toBe(stated.EU.market_provider);
    expect(receipt.eu.status).toBe("binding_applicable_for_defined_class");
    expect(receipt.eu.decisiveEvidence).toEqual(stated.EU.decisive_evidence);
    expect(receipt.eu.supportingEvidence).toEqual(stated.EU.supporting_evidence);
    expect(receipt.eu.supportingEvidence).toEqual(["EU-01", "EU-02", "EU-07", "EU-10B", "EU-11A"]);
    expect(receipt.eu.definedClass).toBe(stated.EU.defined_class);

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

    // They are never collapsed into a single "no regulation" statement.
    expect(subResults).toHaveLength(4);
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

// 12–13. Counts and the source-bundle relationship.
describe("reviewed corpus shape", () => {
  test("24 parent rows and 32 normalized claims, counted from the data", () => {
    const summary = policyTestSummary();
    expect(summary.parentRowCount).toBe(24);
    expect(summary.euParentRowCount).toBe(12);
    expect(summary.usParentRowCount).toBe(12);
    expect(summary.normalizedClaimCount).toBe(32);
    expect(summary.pendingReviewCount).toBe(0);
    expect(summary.rejectedReviewCount).toBe(0);

    // The counts shown agree with the reviewers' own expectations block.
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

    // Children are nested, never flattened into the parent list.
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

  test("the evidence list renders the bundle relationship", () => {
    const evidence = read("components/policy-test/policy-test-evidence.tsx");
    expect(evidence).toContain("group.children.map");
    expect(evidence).toContain("Derived claims");
    expect(evidence).toContain("View all reviewed evidence");
    // Generated from the data, not duplicated by hand.
    expect(evidence).toContain("view.groups.filter");
  });

  test("the rule conditions come from methodology.headline_rule", () => {
    const rule = dataset.methodology.headline_rule;
    expect(policyTestRuleConditions()).toEqual([
      { label: "Actor", value: "Market provider", source: "actor_type" },
      { label: "Conduct", value: "Model evaluation", source: "conduct_type" },
      { label: "Legal force", value: "Binding", source: "legal_force" },
      { label: "Applicability", value: "Applicable", source: "applicability_status" },
      {
        label: "Target class",
        value: "Advanced or general-purpose AI model",
        source: "target_class",
      },
    ]);
    expect(rule.actor_type).toBe("market_provider");
    expect(rule.conduct_type).toBe("model_evaluation");
  });
});

// 14. Mobile layout cannot overflow horizontally.
describe("responsive layout", () => {
  test("no policy-test element uses a fixed width that would break mobile", () => {
    const files = [
      "components/policy-test/policy-test-card.tsx",
      "components/policy-test/policy-test-section.tsx",
      "components/policy-test/policy-test-workspace.tsx",
      "components/policy-test/policy-test-stepper.tsx",
      "components/policy-test/policy-test-evidence.tsx",
      "components/policy-test/policy-test-receipt.tsx",
      "components/policy-test/policy-test-methodology.tsx",
      "components/policy-test/policy-test-rule.tsx",
      "app/policy-test/eu-us-ai-evaluation/page.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      // A fixed `w-[…px]` or a horizontal scroller would overflow a 375px viewport.
      expect(source).not.toMatch(/\bw-\[\d+px\]/);
      expect(source).not.toContain("overflow-x-auto");
      expect(source).not.toContain("overflow-x-scroll");
      expect(source).not.toContain("whitespace-nowrap");
    }
  });

  test("the stepper stacks above the content before the desktop breakpoint", () => {
    const workspace = read("components/policy-test/policy-test-workspace.tsx");
    // Single column by default, two columns only from 900px up.
    expect(workspace).toContain("grid-cols-1");
    expect(workspace).toContain("min-[900px]:grid-cols-[13rem_minmax(0,1fr)]");
    expect(workspace).toContain("min-w-0");
  });

  test("long reviewed values wrap instead of forcing a scrollbar", () => {
    expect(read("components/policy-test/policy-evidence-detail.tsx")).toContain("break-words");
    expect(read("components/policy-test/policy-test-evidence.tsx")).toContain("break-words");
  });
});

// 15. Unknown values are shown, not inferred or removed.
describe("unknown is preserved", () => {
  test("a reviewed unknown reaches the detail panel as unknown", () => {
    const eu06 = entry("EU-06");
    const enforcement = eu06.fields.find((field) => field.label === "Enforcement status");
    expect(enforcement?.value).toBe("unknown");
    expect(enforcement?.tone).toBe("unknown");
  });

  test("every reviewed unknown survives into the view model", () => {
    const unknownInSource = new Set<string>();
    for (const record of dataset.records) {
      if (record.enforcement_status === "unknown") unknownInSource.add(record.row_id);
      for (const child of record.derived_claims ?? []) {
        if (child.enforcement_status === "unknown") unknownInSource.add(child.claim_id);
      }
    }
    expect(unknownInSource.size).toBe(12);

    const unknownInView = new Set(
      entries
        .filter((item) =>
          item.fields.some(
            (field) => field.label === "Enforcement status" && field.value === "unknown",
          ),
        )
        .map((item) => item.id),
    );
    expect(unknownInView).toEqual(unknownInSource);
  });

  test("unknown is rendered in the reserved unknown colour, never blanked", () => {
    const detail = read("components/policy-test/policy-evidence-detail.tsx");
    expect(detail).toContain("text-unknown");
    // An absent value is distinct from a recorded unknown.
    expect(detail).toContain('field.value ?? "Not recorded"');
    expect(read("lib/policy-test.ts")).toContain('value === "unknown" ? "unknown"');
  });

  test("humanize never dresses unknown up as prose", () => {
    expect(humanize("unknown")).toBe("unknown");
    expect(humanize("not_applicable")).toBe("Not applicable");
  });
});

// The reviewed YAML is the only copy of this data.
describe("data provenance", () => {
  test("the generated projection is built from the authoritative YAML", () => {
    const script = read("scripts/embed-policy-test.ts");
    expect(script).toContain("pilot/eu-us-ai-evaluation/annotations/human-reviewed.yaml");
    expect(script).toContain("Bun.YAML.parse");
    // Required fields are checked, and a miss fails the build.
    expect(script).toContain("requireFields");
    expect(script).toContain("headline_judgments");
    expect(script).toContain("validation_expectations");

    // Wired into the build so the projection cannot go stale.
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toContain("embed-policy-test.ts");
    expect(pkg.scripts.embed).toContain("embed-policy-test.ts");
  });

  test("the projection agrees with the reviewed YAML on disk", () => {
    const yaml = readFileSync(
      resolve(WEB_ROOT, "../../pilot/eu-us-ai-evaluation/annotations/human-reviewed.yaml"),
      "utf8",
    );
    const source = Bun.YAML.parse(yaml) as { records: unknown[]; dataset_id: string };
    expect(source.dataset_id).toBe(dataset.dataset_id);
    expect(source.records).toHaveLength(dataset.records.length);
  });

  test("no runtime network request fetches the dataset", () => {
    for (const file of [
      "lib/policy-test.ts",
      "lib/policy-test-data.ts",
      "lib/policy-test-format.ts",
    ]) {
      const source = read(file);
      expect(source).not.toContain("fetch(");
      expect(source).not.toMatch(/https?:\/\/[^"'\s]*\.yaml/);
    }
  });
});
