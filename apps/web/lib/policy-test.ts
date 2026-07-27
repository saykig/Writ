/**
 * Typed reader for the human-reviewed EU–US AI evaluation pilot.
 *
 * The authoritative record is the reviewed YAML annotation table at
 * `pilot/eu-us-ai-evaluation/annotations/human-reviewed.yaml`. It is parsed once
 * at build time by `scripts/embed-policy-test.ts`; this module only reads,
 * indexes, and shapes that data for the interface. Nothing here invents a claim,
 * a count, a jurisdiction, or a piece of supporting evidence.
 *
 * Four distinctions the reviewers drew are load-bearing, and this module keeps
 * each of them in a separate field rather than merging them for display:
 *
 *   - legal force (binding, voluntary, contractual, …) is not compliance
 *     function (direct obligation, recognized compliance path, …);
 *   - adoption, applicability, and enforcement are three lifecycle dimensions;
 *   - market providers, government vendors, and federal agencies bear different
 *     duties, and a government-scoped duty never becomes a market-wide one;
 *   - model evaluation is not evaluation documentation and not risk assessment.
 *
 * `unknown` is a recorded reviewer judgment. It is rendered as `unknown`, never
 * blanked, defaulted, or resolved into something more definite.
 */

import { sha256Canonical } from "@writ/provenance";

import { POLICY_TEST_DATASET, POLICY_TEST_SOURCE_PATH } from "./policy-test-data.js";
import { humanize } from "./policy-test-format.js";

// Presentation helpers live in a Node-free module so client components can
// import them without pulling `node:crypto` in through @writ/provenance.
export {
  formatReviewedDate,
  humanize,
  instrumentLabel,
  scopeLabel,
  statusLabel,
} from "./policy-test-format.js";

export const POLICY_TEST_SLUG = "eu-us-ai-evaluation";
/** Literal so it satisfies the typed-routes `Route` type at call sites. */
export const POLICY_TEST_HREF = "/policy-test/eu-us-ai-evaluation" as const;

export type Jurisdiction = "EU" | "US";

export interface HeadlineRule {
  legal_force: string;
  applicability_status: string;
  actor_type: string;
  conduct_type: string;
  target_class: string;
}

export interface Methodology {
  us_scope: { included: string[]; excluded: string[] };
  actor_types: string[];
  core_conduct_types: string[];
  code_of_practice?: { legal_force: string; compliance_function: string };
  lifecycle_dimensions: string[];
  headline_rule: HeadlineRule;
}

/** Fields shared by a reviewed parent row and a derived claim. */
interface ClaimFields {
  record_type: string;
  legal_force?: string;
  compliance_function?: string;
  adoption_status?: string;
  applicability_status?: string;
  enforcement_status?: string;
  headline_relevance?: string;
  actor_type?: string;
  actor_term_local?: string;
  actor_relationship?: string;
  target_actor?: string;
  recipient_actor_type?: string;
  recipient_actor_term_local?: string;
  indirectly_affected_actor_type?: string;
  additional_affected_actor_type?: string;
  additional_actor_term_local?: string;
  current_actor_type?: string;
  current_actor_term_local?: string;
  prospective_actor_type?: string;
  prospective_actor_term_local?: string;
  defined_actor_class?: string;
  excluded_direct_actor_types?: string[];
  conduct_type?: string;
  conduct_term_local?: string;
  conduct_family?: string;
  evaluation_method?: string[];
  required_vendor_conduct?: string[];
  noncompliance_consequence?: string;
  source_actions?: string[];
  source_lifecycle_activities?: string[];
  source_topics?: string[];
  framework_functions?: string[];
  proposal_action?: string;
  binding_scope?: string;
  scope?: string[];
  covered_scope?: string[];
  target_system?: string;
  responsible_authority?: string;
  responsible_authorities?: string[];
  potential_responsible_authorities?: string[];
  additional_authority?: string;
  implementation_body?: string;
  policy_authority?: string;
  policy_origin?: string;
  exception_scope_local?: string;
  exception_target?: string[];
  exception_conditions_status?: string;
  source_legal_force_label?: string;
  underlying_regime_force?: string;
  underlying_instrument?: string;
  source_instrument_force?: string;
  described_obligation_force?: string;
  classification_indicators?: Record<string, string>;
  effective_from?: string;
  compliance_deadline?: string;
  instrument?: string;
}

export interface DerivedClaim extends ClaimFields {
  claim_id: string;
}

export interface ReviewedRecord extends ClaimFields {
  row_id: string;
  review_decision: "accepted";
  jurisdiction: Jurisdiction;
  instrument: string;
  source_locator: string;
  interpretation_note: string;
  derived_claims?: DerivedClaim[];
}

export interface ValidationExpectations {
  parent_row_count: number;
  eu_parent_row_count: number;
  us_parent_row_count: number;
  normalized_claim_count: number;
  pending_review_count: number;
  rejected_review_count: number;
}

export interface HeadlineJudgments {
  EU: {
    market_provider: string;
    defined_class: string;
    decisive_evidence: string[];
    supporting_evidence: string[];
    qualification: string;
  };
  US: {
    market_provider_cross_sector: string;
    federal_agency_government_use: string;
    government_procurement: string;
    voluntary_cross_sector: string;
    proposed_future: string;
  };
}

export interface ReviewedDataset {
  schema_version: string;
  dataset_id: string;
  review_status: string;
  pilot_question: string;
  methodology: Methodology;
  reconciliation: {
    row_order_authority: string;
    removed_from_main_reviewed_corpus: {
      temporary_row_id: string;
      source_locator: string;
      reason: string;
    }[];
    corrected_numbering: {
      previous_row_id: string;
      source_locator: string;
      corrected_row_id: string;
    }[];
  };
  records: ReviewedRecord[];
  headline_judgments: HeadlineJudgments;
  validation_expectations: ValidationExpectations;
}

export function policyTestDataset(): ReviewedDataset {
  return POLICY_TEST_DATASET;
}

export const POLICY_TEST_SOURCE = POLICY_TEST_SOURCE_PATH;

/* ------------------------------------------------------------------ display */

/** One labelled value in an evidence detail panel. */
export interface EvidenceField {
  label: string;
  /** `null` means the reviewers recorded no value — distinct from `unknown`. */
  value: string | null;
  /** `unknown` renders in the reserved unknown colour so it reads as a judgment. */
  tone: "default" | "unknown" | "mono";
}

export interface EvidenceEntry {
  id: string;
  kind: "parent_record" | "derived_claim";
  parentRowId: string;
  jurisdiction: Jurisdiction;
  instrument: string;
  sourceLocator: string;
  recordType: string;
  /** Short "Actor · Conduct · Force · Applicability" line. Omits absent parts. */
  summary: string;
  interpretationNote: string | null;
  legalForce: string | null;
  actorType: string | null;
  conductType: string | null;
  fields: EvidenceField[];
}

function field(label: string, value: string | undefined | null, mono = false): EvidenceField {
  if (value === undefined || value === null) return { label, value: null, tone: "default" };
  return { label, value, tone: value === "unknown" ? "unknown" : mono ? "mono" : "default" };
}

function summaryOf(claim: ClaimFields): string {
  return [claim.actor_type, claim.conduct_type, claim.legal_force, claim.applicability_status]
    .filter((part): part is string => Boolean(part))
    .map(humanize)
    .join(" · ");
}

function detailFields(
  claim: ClaimFields,
  context: { rowId: string; jurisdiction: Jurisdiction; instrument: string; locator: string },
  interpretationNote: string,
): EvidenceField[] {
  return [
    field("Row ID", context.rowId, true),
    field("Jurisdiction", context.jurisdiction === "EU" ? "European Union" : "United States"),
    field("Instrument", context.instrument, true),
    field("Source locator", context.locator, true),
    field("Actor term", claim.actor_term_local ?? claim.target_actor),
    field("Conduct term", claim.conduct_term_local),
    field("Legal force", claim.legal_force ? humanize(claim.legal_force) : undefined),
    field(
      "Compliance function",
      claim.compliance_function ? humanize(claim.compliance_function) : undefined,
    ),
    field("Adoption status", claim.adoption_status ? humanize(claim.adoption_status) : undefined),
    field(
      "Applicability status",
      claim.applicability_status ? humanize(claim.applicability_status) : undefined,
    ),
    // Kept raw so `unknown` reaches the renderer as `unknown`.
    field("Enforcement status", claim.enforcement_status),
    field("Target system", claim.target_system),
    field(
      "Headline relevance",
      claim.headline_relevance ? humanize(claim.headline_relevance) : undefined,
    ),
    field("Interpretation note", interpretationNote),
  ];
}

/** A parent row together with its derived claims. The relationship is preserved. */
export interface EvidenceGroup {
  parent: EvidenceEntry;
  /** Empty for a leaf row; one entry per child for a source bundle. */
  children: EvidenceEntry[];
  isBundle: boolean;
}

export function policyTestEvidenceGroups(): EvidenceGroup[] {
  const dataset = policyTestDataset();

  return dataset.records.map((record) => {
    const context = {
      rowId: record.row_id,
      jurisdiction: record.jurisdiction,
      instrument: record.instrument,
      locator: record.source_locator,
    };
    const isBundle = record.record_type === "source_bundle";

    const parent: EvidenceEntry = {
      id: record.row_id,
      kind: "parent_record",
      parentRowId: record.row_id,
      jurisdiction: record.jurisdiction,
      instrument: record.instrument,
      sourceLocator: record.source_locator,
      recordType: record.record_type,
      summary: isBundle
        ? `Source bundle · ${record.derived_claims?.length ?? 0} derived claims`
        : summaryOf(record),
      interpretationNote: record.interpretation_note,
      legalForce: record.legal_force ?? null,
      actorType: record.actor_type ?? null,
      conductType: record.conduct_type ?? null,
      fields: detailFields(record, context, record.interpretation_note),
    };

    const children = (record.derived_claims ?? []).map((claim): EvidenceEntry => {
      // A child may override the bundle's instrument; everything else is inherited.
      const childInstrument = claim.instrument ?? record.instrument;
      return {
        id: claim.claim_id,
        kind: "derived_claim",
        parentRowId: record.row_id,
        jurisdiction: record.jurisdiction,
        instrument: childInstrument,
        sourceLocator: record.source_locator,
        recordType: claim.record_type,
        summary: summaryOf(claim),
        interpretationNote: record.interpretation_note,
        legalForce: claim.legal_force ?? null,
        actorType: claim.actor_type ?? null,
        conductType: claim.conduct_type ?? null,
        fields: detailFields(
          claim,
          { ...context, rowId: claim.claim_id, instrument: childInstrument },
          record.interpretation_note,
        ),
      };
    });

    return { parent, children, isBundle };
  });
}

/** Every parent row and derived claim, flattened for lookup by ID only. */
export function policyTestEvidenceEntries(): EvidenceEntry[] {
  return policyTestEvidenceGroups().flatMap((group) => [group.parent, ...group.children]);
}

/* -------------------------------------------------------------- highlights */

export type HighlightTone = "decisive" | "neutral";

export interface HighlightedEvidence {
  id: string;
  title: string;
  badge: string;
  tone: HighlightTone;
  /** Derived from the record's own actor, conduct, force, and applicability. */
  summary: string;
  interpretation: string;
}

/**
 * Four records chosen because together they carry the distinctions the rule
 * turns on: a duty that satisfies it, documentation that does not, voluntary
 * evaluation guidance that does not, and a binding duty that binds agencies
 * rather than providers.
 *
 * Only the title, badge, and interpretation are editorial. Each `summary` is
 * read off the record itself, so a record cannot be described here as something
 * the reviewed data does not say.
 */
const HIGHLIGHT_COPY: {
  id: string;
  title: string;
  badge: string;
  tone: HighlightTone;
  interpretation: string;
}[] = [
  {
    id: "EU-06",
    title: "EU-06 · AI Act Article 55(1)(a)",
    badge: "Decisive match",
    tone: "decisive",
    interpretation:
      "This record directly satisfies the headline rule for providers of general-purpose AI models with systemic risk.",
  },
  {
    id: "EU-01",
    title: "EU-01 · AI Act Article 53(1)(a)",
    badge: "Supporting only",
    tone: "neutral",
    interpretation:
      "This record requires documentation containing evaluation results, but it does not independently require the provider to perform model evaluation.",
  },
  {
    id: "US-03",
    title: "US-03 · NIST Generative AI Profile",
    badge: "Voluntary evaluation",
    tone: "neutral",
    interpretation:
      "This record directly concerns model evaluation, but its voluntary status means it does not create a binding provider obligation.",
  },
  {
    id: "US-08A",
    title: "US-08A · OMB M-25-21",
    badge: "Government-only binding",
    tone: "neutral",
    interpretation:
      "This is a binding testing duty for federal agencies using high-impact AI. It must not be generalized into a market-wide provider obligation.",
  },
];

export function policyTestHighlights(): HighlightedEvidence[] {
  const entries = policyTestEvidenceEntries();
  return HIGHLIGHT_COPY.map((copy) => {
    const entry = entries.find((candidate) => candidate.id === copy.id);
    if (!entry) {
      throw new Error(`policy-test: highlighted record ${copy.id} is not in the reviewed dataset`);
    }
    return { ...copy, summary: entry.summary };
  });
}

/* ------------------------------------------------------------------ summary */

export interface PolicyTestSummary {
  datasetId: string;
  schemaVersion: string;
  reviewStatus: string;
  pilotQuestion: string;
  /** Counted from the records, then checked against the reviewed expectations. */
  parentRowCount: number;
  euParentRowCount: number;
  usParentRowCount: number;
  normalizedClaimCount: number;
  pendingReviewCount: number;
  rejectedReviewCount: number;
}

export function policyTestSummary(): PolicyTestSummary {
  const dataset = policyTestDataset();
  const expectations = dataset.validation_expectations;
  const groups = policyTestEvidenceGroups();

  return {
    datasetId: dataset.dataset_id,
    schemaVersion: dataset.schema_version,
    reviewStatus: dataset.review_status,
    pilotQuestion: dataset.pilot_question,
    parentRowCount: dataset.records.length,
    euParentRowCount: dataset.records.filter((record) => record.jurisdiction === "EU").length,
    usParentRowCount: dataset.records.filter((record) => record.jurisdiction === "US").length,
    normalizedClaimCount: groups.reduce(
      (total, group) => total + (group.isBundle ? group.children.length : 1),
      0,
    ),
    pendingReviewCount: expectations.pending_review_count,
    rejectedReviewCount: expectations.rejected_review_count,
  };
}

/* --------------------------------------------------------------------- rule */

export interface RuleCondition {
  label: string;
  value: string;
  /** The field in `methodology.headline_rule` this condition was read from. */
  source: keyof HeadlineRule;
}

/** The five conditions, read from `methodology.headline_rule` and never restated. */
export function policyTestRuleConditions(): RuleCondition[] {
  const rule = policyTestDataset().methodology.headline_rule;
  return [
    { label: "Actor", value: humanize(rule.actor_type), source: "actor_type" },
    { label: "Conduct", value: humanize(rule.conduct_type), source: "conduct_type" },
    { label: "Legal force", value: humanize(rule.legal_force), source: "legal_force" },
    {
      label: "Applicability",
      value: humanize(rule.applicability_status),
      source: "applicability_status",
    },
    { label: "Target class", value: humanize(rule.target_class), source: "target_class" },
  ];
}

/* ------------------------------------------------------------------ receipt */

export interface UsSubResult {
  key: string;
  title: string;
  finding: string;
  evidence: string[];
}

export interface PolicyTestReceipt {
  datasetId: string;
  schemaVersion: string;
  reviewStatus: string;
  pilotQuestion: string;
  headlineRule: HeadlineRule;
  eu: {
    status: string;
    definedClass: string;
    decisiveEvidence: string[];
    supportingEvidence: string[];
    qualification: string;
    /** Both dates come from the EU-11 lifecycle claims, not from prose. */
    transitionFrom: string | null;
    transitionDeadline: string | null;
  };
  us: {
    status: string;
    subResults: UsSubResult[];
  };
  counts: ValidationExpectations;
  /** `sha256:<hex>` over the canonical JSON of every field above. */
  contentHash: string;
}

/** Every claim-bearing record, keyed by its own ID. Bundles keep their children. */
function claimsById(): Map<string, ClaimFields & { id: string; jurisdiction: Jurisdiction }> {
  const index = new Map<string, ClaimFields & { id: string; jurisdiction: Jurisdiction }>();
  for (const record of policyTestDataset().records) {
    index.set(record.row_id, { ...record, id: record.row_id });
    for (const child of record.derived_claims ?? []) {
      index.set(child.claim_id, {
        ...child,
        id: child.claim_id,
        jurisdiction: record.jurisdiction,
      });
    }
  }
  return index;
}

function claimById(id: string): (ClaimFields & { id: string }) | undefined {
  return claimsById().get(id);
}

/** Claims whose scope, in either scope field, includes the given term. */
function scopedTo(claim: ClaimFields, term: string): boolean {
  return [...(claim.scope ?? []), ...(claim.covered_scope ?? [])].includes(term);
}

/**
 * The four US sub-results, each selected by predicate from the reviewed claims.
 * Keeping them separate is the point: collapsing them would turn binding
 * government-use and procurement duties into a market-wide provider obligation,
 * or erase them into a single "no regulation" claim.
 */
export function policyTestUsSubResults(): UsSubResult[] {
  const usClaims = [...claimsById().values()]
    .filter((claim) => claim.jurisdiction === "US")
    // A bundle parent carries no legal force of its own; its children do.
    .filter((claim) => claim.record_type !== "source_bundle");

  const select = (predicate: (claim: ClaimFields) => boolean): string[] =>
    usClaims
      .filter(predicate)
      .map((claim) => claim.id)
      .sort();

  return [
    {
      key: "government_use",
      title: "Government use",
      finding:
        "Binding testing and impact-assessment requirements for federal agencies using high-impact AI.",
      evidence: select(
        (claim) =>
          claim.legal_force === "binding" &&
          claim.binding_scope === "federal_agencies_only" &&
          scopedTo(claim, "government_use"),
      ),
    },
    {
      key: "government_procurement",
      title: "Government procurement",
      finding: "Binding agency controls and contract-mediated duties for government vendors.",
      evidence: select((claim) => scopedTo(claim, "government_procurement")),
    },
    {
      key: "voluntary_cross_sector",
      title: "Voluntary cross-sector governance",
      finding:
        "Active evaluation guidance and evaluation infrastructure, but no binding market-wide provider duty.",
      evidence: select(
        (claim) => claim.legal_force === "voluntary" && scopedTo(claim, "cross_sector"),
      ),
    },
    {
      key: "proposed_future",
      title: "Proposed future policy",
      finding:
        "A possible future reporting and disclosure standard, not a currently applicable model-evaluation requirement.",
      evidence: select((claim) => claim.legal_force === "proposed"),
    },
  ];
}

export function policyTestReceipt(): PolicyTestReceipt {
  const dataset = policyTestDataset();
  const eu = dataset.headline_judgments.EU;
  const us = dataset.headline_judgments.US;
  const summary = policyTestSummary();

  const transitionFrom = claimById("EU-11A")?.effective_from ?? null;
  const transitionDeadline = claimById("EU-11B")?.compliance_deadline ?? null;

  const receipt: Omit<PolicyTestReceipt, "contentHash"> = {
    datasetId: dataset.dataset_id,
    schemaVersion: dataset.schema_version,
    reviewStatus: dataset.review_status,
    pilotQuestion: dataset.pilot_question,
    headlineRule: dataset.methodology.headline_rule,
    eu: {
      status: eu.market_provider,
      definedClass: eu.defined_class,
      decisiveEvidence: eu.decisive_evidence,
      supportingEvidence: eu.supporting_evidence,
      qualification: eu.qualification,
      transitionFrom,
      transitionDeadline,
    },
    us: {
      status: us.market_provider_cross_sector,
      subResults: policyTestUsSubResults(),
    },
    counts: {
      ...dataset.validation_expectations,
      parent_row_count: summary.parentRowCount,
      normalized_claim_count: summary.normalizedClaimCount,
    },
  };

  // Same convention as every other content hash in the repo: RFC 8785 canonical
  // JSON, SHA-256, `sha256:` prefixed (@writ/provenance).
  return { ...receipt, contentHash: sha256Canonical(receipt) };
}
