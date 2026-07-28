import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
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
import { PRESETS } from "../components/policy-test/policy-test";

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
    expect(section).toContain('title="Where model evaluation is legally binding"');
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
    expect(read("app/policy-test/eu-us-ai-evaluation/page.tsx")).toContain("<PolicyTest ");
    expect(read("components/policy-test/policy-test.tsx")).toContain(
      "Where model evaluation is legally binding.",
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

// 3-5. The rule, as preset scenarios over the reviewed claims.
describe("rule presets", () => {
  const claims = policyTestEvidenceGroups().flatMap((group) =>
    group.isBundle ? group.children : [group.parent],
  );
  const run = (keys: readonly string[]) =>
    claims.filter((claim) =>
      keys.every((key) => claim.checks?.find((check) => check.key === key)?.met),
    );

  test("the reviewed rule is the first preset and requires all four conditions", () => {
    expect(PRESETS[0].id).toBe("reviewed");
    expect(PRESETS[0].label).toBe("The reviewed rule");
    expect([...PRESETS[0].keys].sort()).toEqual(["actor", "applicability", "conduct", "force"]);
  });

  test("every preset draws only on the rule's own conditions", () => {
    const allowed = new Set(["actor", "conduct", "force", "applicability"]);
    for (const preset of PRESETS) {
      expect(preset.keys.length).toBeGreaterThan(0);
      for (const key of preset.keys) expect(allowed.has(key)).toBe(true);
    }
  });

  test("each preset returns the reviewed corpus's real answer", () => {
    const byId = Object.fromEntries(PRESETS.map((preset) => [preset.id, run(preset.keys)]));

    // The rule as written: EU-06 alone.
    expect(byId.reviewed.map((claim) => claim.id)).toEqual(["EU-06"]);

    // Drop everything but the conduct: the US does address model evaluation.
    expect(byId.evaluation.map((claim) => claim.id).sort()).toEqual([
      "EU-06",
      "US-03",
      "US-05A",
      "US-05B",
    ]);
    expect(byId.evaluation.filter((claim) => claim.jurisdiction === "US")).toHaveLength(3);

    // Binding duties on providers: ten in the EU, none in the US.
    expect(byId.provider).toHaveLength(10);
    expect(byId.provider.filter((claim) => claim.jurisdiction === "US")).toHaveLength(0);

    // Any binding duty at all: the US has six, and they bind agencies and vendors.
    expect(byId.binding).toHaveLength(17);
    expect(byId.binding.filter((claim) => claim.jurisdiction === "US")).toHaveLength(6);
    for (const claim of byId.binding.filter((c) => c.jurisdiction === "US")) {
      expect(claim.actorType).not.toBe("market_provider");
    }
  });

  test("loosening a condition never changes the reviewed result on the page", () => {
    // The receipt reports the reviewed rule regardless of what is explored.
    expect(policyTestReceipt().eu.decisiveEvidence).toEqual(["EU-06"]);
    expect(policyTestReceipt().us.status).toBe("no_current_binding_model_evaluation_requirement");
  });

  test("the whole feature is one component the page hands data to", () => {
    const page = read("app/policy-test/eu-us-ai-evaluation/page.tsx");
    expect(page).toContain("<PolicyTest ");
    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("stage");

    // One traceable component, not a scatter of coupled pieces.
    const components = readdirSync(resolve(WEB_ROOT, "components/policy-test")).sort();
    expect(components).toEqual([
      "policy-test-card.tsx",
      "policy-test-section.tsx",
      "policy-test.tsx",
    ]);
  });

  test("nothing in the policy test opens in a dialog", () => {
    for (const file of ["policy-test.tsx", "policy-test-card.tsx", "policy-test-section.tsx"]) {
      const source = read(`components/policy-test/${file}`);
      expect(source).not.toContain("ui/sheet");
      expect(source).not.toContain("ui/dialog");
      expect(source).not.toContain('aria-haspopup="dialog"');
    }
    // Records open in place, using the shared Accordion.
    expect(read("components/policy-test/policy-test.tsx")).toContain(
      'from "@/components/ui/accordion"',
    );
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
    const source = read("components/policy-test/policy-test.tsx");
    // Children render nested inside their parent's item, not as siblings.
    expect(source).toContain("group.children.map");
    expect(source).toContain("<Record key={child.id} entry={child} isChild />");
    expect(source).toContain("All reviewed evidence");
    // Generated from the data, not duplicated by hand.
    expect(source).toContain("view.groups.filter");
    // The bundle parent names its child count rather than pretending to be a claim.
    expect(read("lib/policy-test.ts")).toContain("Source bundle · ");
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
      // is shown as part of the rule but is never used as a filter.
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

// 14. Mobile layout cannot overflow horizontally.
describe("responsive layout", () => {
  const files = [
    "components/policy-test/policy-test.tsx",
    "components/policy-test/policy-test-card.tsx",
    "components/policy-test/policy-test-section.tsx",
    "app/policy-test/eu-us-ai-evaluation/page.tsx",
  ];

  test("no policy-test element uses a fixed width or a sideways scroller", () => {
    for (const file of files) {
      const source = read(file);
      // A fixed `w-[…px]` or a horizontal scroller would overflow a 375px viewport.
      expect(source).not.toMatch(/\bw-\[\d+px\]/);
      expect(source).not.toContain("overflow-x-auto");
      expect(source).not.toContain("overflow-x-scroll");
      expect(source).not.toContain("whitespace-nowrap");
    }
  });

  test("the preset row and the rule chips wrap", () => {
    const source = read("components/policy-test/policy-test.tsx");
    expect(source).toContain("flex-wrap");
    expect(source).toContain("min-w-0");
  });

  test("long reviewed values wrap instead of forcing a scrollbar", () => {
    expect(read("components/policy-test/policy-test.tsx")).toContain("break-words");
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
    const evidence = read("components/policy-test/policy-test.tsx");
    expect(evidence).toContain("text-unknown");
    // An absent value is distinct from a recorded unknown.
    expect(evidence).toContain('field.value ?? "Not recorded"');
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
