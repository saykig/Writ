/**
 * Server-side loader for the checked-in conformance corpus at repo-root
 * `internal/verification/conformance/cases/**`. Nothing here reimplements the semantics: it reads the
 * frozen case files, counts cases per area (a file holds either one case object
 * or an array of them), and surfaces a few representative shapes verbatim.
 *
 * The ten areas and their one-line coverage come from
 * `internal/verification/conformance/README.md`;
 * per-area counts are computed from the files, so the total is whatever the
 * corpus actually holds (130 across 22 files at time of writing).
 */

import { listRepoDir, readRepoJson } from "@/lib/repo";

const CASES_DIR = "internal/verification/conformance/cases";

/** One conformance case (the closed shape from `case.schema.json`). */
export interface ConformanceCase {
  readonly id: string;
  readonly area: string;
  readonly kind: string;
  readonly description: string;
  readonly input: unknown;
  readonly expected: unknown;
}

/** A semantic area with its computed file/case counts. */
export interface ConformanceArea {
  readonly id: string;
  readonly title: string;
  readonly covers: string;
  readonly files: number;
  readonly cases: number;
}

export interface ConformanceCoverage {
  readonly areas: readonly ConformanceArea[];
  readonly totalCases: number;
  readonly totalFiles: number;
}

/**
 * The ten areas in corpus order, each with the one-line coverage note from
 * `internal/verification/conformance/README.md`. Counts are filled in from the files below.
 */
const AREA_META: readonly { id: string; title: string; covers: string }[] = [
  {
    id: "truth",
    title: "Truth",
    covers: "The four-valued kernel: not / and / or tables and empty quantifiers.",
  },
  {
    id: "expressions",
    title: "Expressions",
    covers: "Equality, comparison, exact decimals, sets, count-interval thresholds.",
  },
  {
    id: "temporal",
    title: "Temporal",
    covers: "before / after / overlaps and date-only whole-day boundaries.",
  },
  {
    id: "quantities",
    title: "Quantities",
    covers: "Money bounds (exact / up_to / at_least) and currency compatibility.",
  },
  {
    id: "identity",
    title: "Identity",
    covers: "Distinct-count intervals under the four action-identity policies.",
  },
  {
    id: "classification",
    title: "Classification",
    covers: "Exclusive vs multi-label selection, ambiguity, unknown not defaulting.",
  },
  {
    id: "scoring",
    title: "Scoring",
    covers: "Deterministic score selection and bounded score analysis.",
  },
  {
    id: "proofs",
    title: "Proofs",
    covers: "Receipt result / status, deterministic replay, hash verification.",
  },
  {
    id: "canonicalization",
    title: "Canonicalization",
    covers: "RFC 8785 canonical JSON and content hashing.",
  },
  {
    id: "diagnostics",
    title: "Diagnostics",
    covers: "Stable diagnostic codes for lint, type, and unit findings.",
  },
];

function jsonFiles(area: string): string[] {
  return listRepoDir(`${CASES_DIR}/${area}`)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function countCasesInFile(area: string, file: string): number {
  const data = readRepoJson<unknown>(`${CASES_DIR}/${area}/${file}`);
  return Array.isArray(data) ? data.length : 1;
}

let coverageCache: ConformanceCoverage | undefined;

/** Compute per-area file/case counts from the corpus (cached for the process). */
export function loadCoverage(): ConformanceCoverage {
  if (coverageCache !== undefined) return coverageCache;
  let totalCases = 0;
  let totalFiles = 0;
  const areas = AREA_META.map((meta) => {
    const files = jsonFiles(meta.id);
    const cases = files.reduce((sum, file) => sum + countCasesInFile(meta.id, file), 0);
    totalCases += cases;
    totalFiles += files.length;
    return { ...meta, files: files.length, cases };
  });
  coverageCache = { areas, totalCases, totalFiles };
  return coverageCache;
}

/** Read the first case object from a file (unwrapping a single-element or array file). */
function firstCase(rel: string): ConformanceCase {
  const data = readRepoJson<ConformanceCase | ConformanceCase[]>(rel);
  return Array.isArray(data) ? data[0] : data;
}

export interface RepresentativeCase {
  readonly file: string;
  readonly caseData: ConformanceCase;
  readonly json: string;
}

/**
 * A compact, varied sample of real cases for display: a truth-table entry, a
 * distinct-count query under an identity policy, and a content-hash case. Each
 * is rendered verbatim as canonical-ish JSON so the `{id, area, kind, input,
 * expected}` shape is visible.
 */
export function representativeCases(): readonly RepresentativeCase[] {
  const picks = [
    `${CASES_DIR}/truth/and.json`,
    `${CASES_DIR}/identity/count-policies.json`,
    `${CASES_DIR}/canonicalization/hash.json`,
  ];
  return picks.map((rel) => {
    const caseData = firstCase(rel);
    return {
      file: rel.replace(`${CASES_DIR}/`, ""),
      caseData,
      json: JSON.stringify(caseData, null, 2),
    };
  });
}
