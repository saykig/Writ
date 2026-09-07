import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  encodedBytes,
  exactJsonBytes,
  type CaseSourceDocument,
  type DecisionCase,
} from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";

import type { BundleImport, RevisionDeclaration, SourceIdentity } from "../src/index.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const FIXTURE_ROOT = join(ROOT, "examples", "decision-cases", "shared-analysis-revision");

export function fixture(relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURE_ROOT, relativePath)));
}

export const V1_SOURCE: SourceIdentity = {
  source_id: "writ.source.synthetic-shared-failure-inputs",
  document_version_id: "synthetic-shared-inputs.v1",
  sha256: "sha256:302fc7940f0c2e4e744320abdb76c52b7cba20c9aad6edbefdd316e225b796fa",
};

export const V2_SOURCE_ONLY: CaseSourceDocument = {
  source_id: "writ.source.synthetic-shared-failure-inputs",
  document_version_id: "synthetic-shared-inputs.v2-source-only",
  media_type: "text/plain",
  ...encodedBytes(fixture("sources/shared-v2-source-only.txt")),
};

export const V3_X_HALF: CaseSourceDocument = {
  source_id: "writ.source.synthetic-shared-failure-inputs",
  document_version_id: "synthetic-shared-inputs.v3-x-half",
  media_type: "text/plain",
  ...encodedBytes(fixture("sources/shared-v3-x-half.txt")),
};

export const ALTERNATIVE_Y: CaseSourceDocument = {
  source_id: "writ.source.synthetic-y-route-2",
  document_version_id: "synthetic-y-route-2.v1",
  media_type: "text/plain",
  ...encodedBytes(fixture("sources/alternative-y-v1.txt")),
};

function completeImport(bundleId: "alpha" | "beta"): BundleImport {
  return {
    bundle_id: bundleId,
    case_bytes: fixture(`${bundleId}.case.json`),
    selected_analysis_ids: ["analysis-base"],
    inventory: {
      scope: "synthetic shared failure decision",
      completeness: "complete",
      unresolved_references: [],
      support_routes:
        bundleId === "beta"
          ? [
              {
                route_id: "route-y-shared",
                statement_id: "statement.y-quarter",
                statement_scope: "synthetic shared failure decision",
                premise_sources: [V1_SOURCE],
              },
              {
                route_id: "route-y-alternative",
                statement_id: "statement.y-quarter",
                statement_scope: "synthetic shared failure decision",
                premise_sources: [
                  {
                    source_id: ALTERNATIVE_Y.source_id,
                    document_version_id: ALTERNATIVE_Y.document_version_id,
                    sha256: ALTERNATIVE_Y.sha256,
                  },
                ],
              },
            ]
          : [],
    },
    supplemental_sources: bundleId === "beta" ? [ALTERNATIVE_Y] : [],
  };
}

export const alphaImport = completeImport("alpha");
export const betaImport = completeImport("beta");

export const unaffectedImport: BundleImport = {
  bundle_id: "unaffected",
  case_bytes: new Uint8Array(
    readFileSync(
      join(
        ROOT,
        "examples",
        "decision-cases",
        "failure-choice",
        "case.json",
      ),
    ),
  ),
  selected_analysis_ids: ["revision-0"],
  inventory: {
    scope: "bounded unrelated fixture inventory",
    completeness: "complete",
    unresolved_references: [],
    support_routes: [],
  },
};

export const partialImport: BundleImport = {
  ...unaffectedImport,
  bundle_id: "partial",
  inventory: {
    scope: "bounded inventory with omitted ancestry",
    completeness: "partial",
    unresolved_references: ["external:omitted-ancestry"],
    support_routes: [],
  },
};

export function sourceOnlyRevision(): RevisionDeclaration {
  return {
    revision_id: "revision.source-only-v2",
    kind: "source_revision",
    summary: "Replace the shared source wording without changing its mathematical quantities.",
    source_replacements: [{ from: V1_SOURCE, to: V2_SOURCE_ONLY }],
    withdrawn_sources: [],
    withdrawn_dependencies: [],
    withdrawn_routes: [],
    conflicting_premises: [],
    transitions: [
      {
        prior: { bundle_id: "alpha", analysis_id: "analysis-base" },
        successor_case: encodedBytes(fixture("revisions/source-only/alpha.case.json")),
        successor_analysis_id: "analysis-base",
      },
      {
        prior: { bundle_id: "beta", analysis_id: "analysis-base" },
        successor_case: encodedBytes(fixture("revisions/source-only/beta.case.json")),
        successor_analysis_id: "analysis-base",
      },
    ],
  };
}

export function quantitativeRevision(): RevisionDeclaration {
  return {
    revision_id: "revision.x-half-v3",
    kind: "source_revision",
    summary: "Explicitly replace X=1/4 with X=1/2 while retaining Y=1/4 and the loss rows.",
    source_replacements: [{ from: V1_SOURCE, to: V3_X_HALF }],
    withdrawn_sources: [],
    withdrawn_dependencies: [],
    withdrawn_routes: [],
    conflicting_premises: [],
    transitions: [
      {
        prior: { bundle_id: "alpha", analysis_id: "analysis-base" },
        successor_case: encodedBytes(fixture("revisions/quantitative/alpha.case.json")),
        successor_analysis_id: "analysis-base",
      },
      {
        prior: { bundle_id: "beta", analysis_id: "analysis-base" },
        successor_case: encodedBytes(fixture("revisions/quantitative/beta.case.json")),
        successor_analysis_id: "analysis-base",
      },
    ],
  };
}

export function withdrawalRevision(): RevisionDeclaration {
  return {
    revision_id: "revision.alpha-withdraw-independence",
    kind: "assumption_withdrawal",
    summary: "Withdraw alpha's independence premise without replacing it.",
    source_replacements: [],
    withdrawn_sources: [],
    withdrawn_dependencies: [
      {
        bundle_id: "alpha",
        analysis_id: "analysis-base",
        dependency_id: "choice.independence",
      },
    ],
    withdrawn_routes: [],
    conflicting_premises: [],
    transitions: [
      {
        prior: { bundle_id: "alpha", analysis_id: "analysis-base" },
        successor_case: encodedBytes(fixture("revisions/independence-withdrawn/alpha.case.json")),
        successor_analysis_id: "analysis-base",
      },
    ],
  };
}

export function conflictingCaseBytes(): Uint8Array {
  const beta = JSON.parse(new TextDecoder().decode(betaImport.case_bytes)) as DecisionCase;
  const original = beta.source_documents.find(
    ({ source_id, document_version_id }) =>
      source_id === V1_SOURCE.source_id && document_version_id === V1_SOURCE.document_version_id,
  )!;
  const changedBytes = new Uint8Array([
    ...Buffer.from(original.content, "base64"),
    ...new TextEncoder().encode("Conflicting undeclared byte.\n"),
  ]);
  const changed = encodedBytes(changedBytes);
  (original as unknown as Record<string, unknown>).content = changed.content;
  (original as unknown as Record<string, unknown>).sha256 = changed.sha256;
  for (const reference of beta.source_references) {
    if (
      reference.source_id === V1_SOURCE.source_id &&
      reference.document_version_id === V1_SOURCE.document_version_id
    ) {
      (reference as unknown as { document_hash: string }).document_hash = changed.sha256;
    }
  }
  return exactJsonBytes(beta);
}

export function sha256(value: unknown): string {
  return sha256Bytes(exactJsonBytes(value));
}
