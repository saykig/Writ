/**
 * Generate `lib/policy-test-data.ts` — the human-reviewed EU–US AI evaluation
 * pilot, parsed from its byte-preserved archived YAML at build time.
 *
 * Why build time: the reviewed dataset is YAML, but the Next build and the
 * serverless runtime are Node, where no YAML parser is installed. Bun ships one
 * (`Bun.YAML`), and this script runs under Bun, so the parse happens once here
 * and the site imports plain typed data. That keeps the authoritative file the
 * single copy of the data (the frontend never re-types it by hand), adds no
 * dependency, and never reads the file over the network at runtime.
 *
 * The only transform applied is whitespace collapsing on string leaves. YAML
 * folded scalars (`>`) are authored across several lines and carry a trailing
 * newline; collapsing restores the single-line value the folding already means.
 * No value is substituted, defaulted, or dropped — `unknown` stays `unknown`.
 *
 * Run: `bun scripts/embed-policy-test.ts` (wired into the web app `embed` and
 * `build` scripts, alongside `embed-frozen.ts`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const outFile = join(here, "..", "lib", "policy-test-data.ts");

const SOURCE_REL =
  "archive/pilots/eu-us-ai-evaluation-v1/original/annotations/human-reviewed.yaml";

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
  throw new Error(`embed-policy-test: ${message} (source: ${SOURCE_REL})`);
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

// 5. Headline judgments are read straight from the reviewed block.
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

const body = `// AUTO-GENERATED by scripts/embed-policy-test.ts — do not edit by hand.
// The human-reviewed EU–US AI evaluation pilot, parsed at build time from
// ${SOURCE_REL}. That YAML is the single authoritative
// copy of this data; this file is a projection of it, not a second source.
// Regenerated by the web app's \`embed\` and \`build\` scripts.

import type { ReviewedDataset } from "./policy-test";

export const POLICY_TEST_SOURCE_PATH = ${JSON.stringify(SOURCE_REL)};

export const POLICY_TEST_DATASET: ReviewedDataset = ${JSON.stringify(dataset, null, 2)};
`;

writeFileSync(outFile, body);
console.log(
  `embed-policy-test: wrote ${outFile} (${records.length} parent rows, ` +
    `${computed.normalized_claim_count} normalized claims)`,
);
