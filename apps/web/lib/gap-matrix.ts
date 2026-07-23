/**
 * Server-side reproduction of Sara Kim's Gap Matrix, run through the real
 * Covenant toolchain: compile the graded-measure methodology, evaluate it against
 * her analyst assessments (encoded as reviewed evidence), and return the
 * reproduced axis indices plus the static measure findings. Deterministic and
 * filesystem-free (the methodology + assessments are inlined via `frozen-data`).
 */

import { compileSource } from "@covenant/language";
import { evaluateCommitment } from "@covenant/evaluator";
import { analyzeMeasures } from "@covenant/analyzer/measure-analysis";
import type { CanonicalIr, Evidence } from "@covenant/domain";
import { readRepoJson, readRepoText } from "./repo.js";

const CUTOFF = "2026-07-21T00:00:00Z";
const SOURCE = "examples/ai-governance-gap-matrix.covenant";
const ASSESSMENTS = "benchmark/ai-governance-gap-matrix/assessments.json";

interface AssessmentComponent {
  readonly component: string;
  readonly label: string;
  readonly weight: number;
  readonly assessed_level: number | null;
  readonly status: string | null;
}
interface AssessmentData {
  readonly field: string;
  readonly label: string;
  readonly geographic_scope: readonly string[];
  readonly evidence_cutoff: string;
  readonly axes: {
    readonly knowledgeConcentration: readonly AssessmentComponent[];
    readonly publicAuthority: readonly AssessmentComponent[];
  };
}

export interface GapMatrixComponent {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly level: number | null;
  readonly pending: boolean;
}
export interface GapMatrixAxis {
  readonly id: string;
  readonly label: string;
  readonly index: number | null;
  readonly pending: boolean;
  readonly components: readonly GapMatrixComponent[];
}
export interface GapMatrixResult {
  readonly field: string;
  readonly label: string;
  readonly scope: readonly string[];
  readonly cutoff: string;
  readonly axes: readonly GapMatrixAxis[];
  readonly findings: readonly { readonly code: string; readonly message: string }[];
}

const componentId = (cepheusId: string): string => cepheusId.replace(/-/g, "_");

/** Build the assessment evidence: one reviewed `assessed_level` claim per scored component. */
function buildSnapshot(data: AssessmentData): Evidence {
  const claims: unknown[] = [];
  const reviews: unknown[] = [];
  const all = [...data.axes.knowledgeConcentration, ...data.axes.publicAuthority];
  for (const c of all) {
    if (c.assessed_level === null) continue; // pending ⇒ no reviewed level
    const id = `claim-${c.component}`;
    claims.push({
      id,
      claim_type: "assessment",
      subject_ref: c.component,
      predicate: "assessed_level",
      object: c.assessed_level,
      truth_value: "true",
      status: "accepted",
      recorded_at: "2026-01-01T00:00:00Z",
      evidence_links: ["passage-gap-matrix"],
    });
    reviews.push({
      id: `review-${c.component}`,
      object_id: id,
      object_type: "claim",
      decision: "accept",
    });
  }
  return {
    schema_version: "1.0.0",
    snapshot: {
      id: "snap-gap-matrix",
      frozen_at: CUTOFF,
      cutoff: CUTOFF,
      content_hash: `sha256:${"0".repeat(64)}`,
    },
    document_versions: [],
    passages: [],
    claims,
    actions: [],
    reviews,
  } as unknown as Evidence;
}

let cache: GapMatrixResult | undefined;

export function gapMatrix(): GapMatrixResult {
  if (cache !== undefined) return cache;

  const data = readRepoJson<AssessmentData>(ASSESSMENTS);
  const compiled = compileSource(readRepoText(SOURCE), {
    fileName: "ai-governance-gap-matrix.covenant",
  });
  const ir = compiled.ir as CanonicalIr;
  const commitment = ir.commitments[0]!;

  const receipt = evaluateCommitment({
    ir,
    commitmentId: commitment.id,
    snapshot: buildSnapshot(data),
    subject: data.field,
    cutoff: CUTOFF,
  });
  const measures =
    (receipt as unknown as { measures?: Array<Record<string, unknown>> }).measures ?? [];

  const axisSpecs: { id: string; label: string; source: readonly AssessmentComponent[] }[] = [
    {
      id: "knowledge_concentration",
      label: "Knowledge concentration",
      source: data.axes.knowledgeConcentration,
    },
    { id: "public_authority", label: "Public authority", source: data.axes.publicAuthority },
  ];

  const axes: GapMatrixAxis[] = axisSpecs.map((spec) => {
    const measure = measures.find((m) => m.id === spec.id) as
      | {
          internal_score: number | null;
          pending: boolean;
          components: { id: string; pending: boolean }[];
        }
      | undefined;
    const labelById = new Map(spec.source.map((c) => [componentId(c.component), c]));
    const components: GapMatrixComponent[] = (measure?.components ?? []).map((mc) => {
      const seed = labelById.get(mc.id);
      return {
        id: mc.id,
        label: seed?.label ?? mc.id,
        weight: seed?.weight ?? 0,
        level: seed?.assessed_level ?? null,
        pending: mc.pending,
      };
    });
    return {
      id: spec.id,
      label: spec.label,
      index: measure?.internal_score ?? null,
      pending: measure?.pending ?? true,
      components,
    };
  });

  const findings = analyzeMeasures(commitment.measures ?? [], {}, { objectId: commitment.id }).map(
    (f) => ({ code: f.code, message: f.message }),
  );

  cache = {
    field: data.field,
    label: data.label,
    scope: data.geographic_scope,
    cutoff: data.evidence_cutoff,
    axes,
    findings,
  };
  return cache;
}
