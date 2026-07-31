/**
 * Generate `lib/demo-analysis-data.ts` — the human-reviewed EU–US AI evaluation
 * pilot, parsed from its byte-preserved archived YAML at build time and checked
 * against the independent active EU and US corpora.
 *
 * Why build time: the reviewed dataset is YAML, but the Next build and the
 * serverless runtime are Node, where no YAML parser is installed. Bun ships one
 * (`Bun.YAML`), and this script runs under Bun, so the parse happens once here
 * and the site imports plain typed data. That keeps the authoritative file the
 * historical question/grouping intact while the active corpus files remain the
 * authority for current records. The frontend never re-types either by hand.
 *
 * The only transform applied is whitespace collapsing on string leaves. YAML
 * folded scalars (`>`) are authored across several lines and carry a trailing
 * newline; collapsing restores the single-line value the folding already means.
 * No value is substituted, defaulted, or dropped — `unknown` stays `unknown`.
 *
 * Run: `bun scripts/embed-demo-analysis.ts` (wired into the web app `embed` and
 * `build` scripts, alongside `embed-frozen.ts`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const outFile = join(here, "..", "lib", "demo-analysis-data.ts");

const SOURCE_REL =
  "archive/pilots/eu-us-ai-evaluation-v1/original/annotations/human-reviewed.yaml";
const ACTIVE_CORPORA = {
  EU: "corpora/jurisdictions/eu/ai-governance",
  US: "corpora/jurisdictions/us/ai-governance",
} as const;

/** Collapse folded-scalar whitespace. Whitespace-only, and idempotent. */
function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalize(value: unknown): unknown {
  if (typeof value === "string") return collapse(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}

function fail(message: string): never {
  throw new Error(`embed-demo-analysis: ${message} (source: ${SOURCE_REL})`);
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`expected an object at ${path}`);
  }
  return value as Record<string, unknown>;
}

function requireFields(value: Record<string, unknown>, path: string, fields: string[]): void {
  const missing = fields.filter((field) => value[field] === undefined);
  if (missing.length > 0) fail(`missing required field(s) at ${path}: ${missing.join(", ")}`);
}

const text = readFileSync(join(repoRoot, SOURCE_REL), "utf8");
const dataset = requireObject(normalize(Bun.YAML.parse(text)), "<root>");

// 1. Required top-level fields. A missing one fails the build rather than
//    rendering a page with a silently absent section.
requireFields(dataset, "<root>", [
  "schema_version",
  "dataset_id",
  "review_status",
  "pilot_question",
  "methodology",
  "reconciliation",
  "records",
  "headline_judgments",
  "validation_expectations",
]);

if (dataset.review_status !== "human_reviewed") {
  fail(`review_status must be "human_reviewed", found ${JSON.stringify(dataset.review_status)}`);
}

// 2. The rule the site renders is read from the methodology, never restated.
const methodology = requireObject(dataset.methodology, "methodology");
requireFields(methodology, "methodology", [
  "us_scope",
  "actor_types",
  "core_conduct_types",
  "lifecycle_dimensions",
  "headline_rule",
]);
requireFields(requireObject(methodology.headline_rule, "methodology.headline_rule"), "methodology.headline_rule", [
  "legal_force",
  "applicability_status",
  "actor_type",
  "conduct_type",
  "target_class",
]);
requireFields(requireObject(methodology.us_scope, "methodology.us_scope"), "methodology.us_scope", [
  "included",
  "excluded",
]);

// 3. Records, with parent bundles and their derived claims kept intact.
if (!Array.isArray(dataset.records)) fail("records must be an array");
const records = dataset.records as Record<string, unknown>[];

let derivedClaimCount = 0;
for (const [index, record] of records.entries()) {
  const at = `records[${index}]`;
  requireFields(record, at, [
    "row_id",
    "review_decision",
    "jurisdiction",
    "instrument",
    "source_locator",
    "record_type",
    "interpretation_note",
  ]);
  if (record.review_decision !== "accepted") {
    fail(`${at} (${String(record.row_id)}) is not accepted: ${String(record.review_decision)}`);
  }
  if (record.record_type === "source_bundle") {
    if (!Array.isArray(record.derived_claims) || record.derived_claims.length === 0) {
      fail(`${at} (${String(record.row_id)}) is a source_bundle with no derived_claims`);
    }
    for (const [childIndex, child] of record.derived_claims.entries()) {
      requireFields(requireObject(child, `${at}.derived_claims[${childIndex}]`), `${at}.derived_claims[${childIndex}]`, [
        "claim_id",
        "record_type",
        "legal_force",
        "adoption_status",
        "applicability_status",
        "enforcement_status",
        "headline_relevance",
      ]);
    }
    derivedClaimCount += record.derived_claims.length;
  } else {
    requireFields(record, `${at} (${String(record.row_id)})`, [
      "legal_force",
      "adoption_status",
      "applicability_status",
      "enforcement_status",
      "headline_relevance",
    ]);
  }
}

// 4. Counts are computed from the records, then checked against the reviewed
//    expectations. The site displays the computed values; a disagreement here
//    means one of the two is stale, so the build stops.
const expectations = requireObject(dataset.validation_expectations, "validation_expectations");
requireFields(expectations, "validation_expectations", [
  "parent_row_count",
  "eu_parent_row_count",
  "us_parent_row_count",
  "normalized_claim_count",
  "pending_review_count",
  "rejected_review_count",
]);

const leafCount = records.filter((record) => record.record_type !== "source_bundle").length;
const computed = {
  parent_row_count: records.length,
  eu_parent_row_count: records.filter((record) => record.jurisdiction === "EU").length,
  us_parent_row_count: records.filter((record) => record.jurisdiction === "US").length,
  normalized_claim_count: leafCount + derivedClaimCount,
};

for (const [field, value] of Object.entries(computed)) {
  if (expectations[field] !== value) {
    fail(`${field}: computed ${value}, reviewed expectation ${String(expectations[field])}`);
  }
}

// 5. The historical parent grouping must still resolve exactly to the active
//    reviewed corpus projections. This lets the Demo retain the saved question
//    without treating the archived combined dataset as an active corpus.
const archivedClaimRefs: string[] = [];
const archivedParentRefs = new Set<string>();
for (const record of records) {
  archivedParentRefs.add(String(record.row_id));
  if (record.record_type === "source_bundle") {
    for (const child of record.derived_claims as Record<string, unknown>[]) {
      archivedClaimRefs.push(String(child.claim_id));
    }
  } else {
    archivedClaimRefs.push(String(record.row_id));
  }
}

const activeClaimIds = new Set<string>();
const activeLegacyRefs = new Map<string, string>();
const activeParentRefs = new Set<string>();
for (const [jurisdiction, base] of Object.entries(ACTIVE_CORPORA)) {
  const claimsDoc = requireObject(
    normalize(Bun.YAML.parse(readFileSync(join(repoRoot, base, "records/claims.yaml"), "utf8"))),
    `${jurisdiction}.claims`,
  );
  const reviewsDoc = requireObject(
    normalize(
      Bun.YAML.parse(readFileSync(join(repoRoot, base, "reviews/parent-annotations.yaml"), "utf8")),
    ),
    `${jurisdiction}.reviews`,
  );
  if (!Array.isArray(claimsDoc.claims) || !Array.isArray(reviewsDoc.reviews)) {
    fail(`${jurisdiction} active claims or reviews are not arrays`);
  }
  const expectedClaims = jurisdiction === "EU" ? 15 : 17;
  if (claimsDoc.claims.length !== expectedClaims || reviewsDoc.reviews.length !== 12) {
    fail(
      `${jurisdiction} active corpus count mismatch: ${claimsDoc.claims.length} claims, ` +
        `${reviewsDoc.reviews.length} parent reviews`,
    );
  }
  for (const rawClaim of claimsDoc.claims) {
    const claim = requireObject(rawClaim, `${jurisdiction}.claim`);
    requireFields(claim, `${jurisdiction}.claim`, ["machine_id", "legacy_refs"]);
    const machineId = String(claim.machine_id);
    if (activeClaimIds.has(machineId)) fail(`duplicate active claim machine_id ${machineId}`);
    activeClaimIds.add(machineId);
    for (const legacyRef of claim.legacy_refs as unknown[]) {
      const legacy = String(legacyRef);
      if (activeLegacyRefs.has(legacy)) fail(`legacy ref ${legacy} resolves more than once`);
      activeLegacyRefs.set(legacy, machineId);
    }
  }
  for (const rawReview of reviewsDoc.reviews) {
    const review = requireObject(rawReview, `${jurisdiction}.review`);
    requireFields(review, `${jurisdiction}.review`, ["imported_parent_legacy_ref"]);
    activeParentRefs.add(String(review.imported_parent_legacy_ref));
  }
}

if (archivedClaimRefs.length !== activeClaimIds.size) {
  fail(`archived ${archivedClaimRefs.length} claims do not match ${activeClaimIds.size} active claims`);
}
for (const legacyRef of archivedClaimRefs) {
  if (!activeLegacyRefs.has(legacyRef)) fail(`archived claim ${legacyRef} has no active resolution`);
}
for (const legacyRef of archivedParentRefs) {
  if (!activeParentRefs.has(legacyRef)) fail(`archived parent ${legacyRef} has no active review`);
}

// 6. Headline judgments are read straight from the historical reviewed block.
const headlines = requireObject(dataset.headline_judgments, "headline_judgments");
requireFields(headlines, "headline_judgments", ["EU", "US"]);
requireFields(requireObject(headlines.EU, "headline_judgments.EU"), "headline_judgments.EU", [
  "market_provider",
  "defined_class",
  "decisive_evidence",
  "supporting_evidence",
  "qualification",
]);
requireFields(requireObject(headlines.US, "headline_judgments.US"), "headline_judgments.US", [
  "market_provider_cross_sector",
  "federal_agency_government_use",
  "government_procurement",
  "voluntary_cross_sector",
  "proposed_future",
]);

const body = `// AUTO-GENERATED by scripts/embed-demo-analysis.ts — do not edit by hand.
// Historical question and grouping are parsed at build time from ${SOURCE_REL}.
// Its 24 review groups and 32 claims are verified against the active independent
// EU and US corpora before this compatibility view is emitted.
// Regenerated by the web app's \`embed\` and \`build\` scripts.

import type { ReviewedDataset } from "./demo-analysis";

export const DEMO_ANALYSIS_SOURCE_PATH = ${JSON.stringify(SOURCE_REL)};
export const DEMO_ANALYSIS_CORPUS_PATHS = ${JSON.stringify(ACTIVE_CORPORA, null, 2)} as const;

export const DEMO_ANALYSIS_DATASET: ReviewedDataset = ${JSON.stringify(dataset, null, 2)};
`;

writeFileSync(outFile, body);
console.log(
  `embed-demo-analysis: wrote ${outFile} (${records.length} parent rows, ` +
    `${computed.normalized_claim_count} normalized claims)`,
);
