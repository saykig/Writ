/**
 * The real Writ toolchain, wrapped for the site's server layer.
 *
 * Every function runs the checked-in semantic packages server-side — the
 * language front end, the deterministic evaluator, the bounded score analyzer,
 * and the frozen archived pilot evidence. Nothing is reimplemented; the
 * site only orchestrates and shapes results. Repo data is read via `repo.ts`.
 */

import { compileSource, type LanguageDiagnostic } from "@writ/language";
import { evaluateCommitment, verifyReceipt } from "@writ/evaluator";
import type {
  CanonicalIr,
  Diagnostic,
  EvaluationReceipt,
  Evidence,
  InterpretationProfile,
} from "@writ/domain";
import { analyzeCommitment } from "./analysis.js";
import { readRepoJson, readRepoText } from "./repo.js";

// --- The archived EU-US saved query: what the Lab runs ----------------------
//
// One question — does the jurisdiction impose a binding model-evaluation duty on
// providers of advanced AI models? — asked three ways. Each reading is a real
// `.writ` file, each runs against evidence snapshots whose every claim is linked
// to the retrieved text of the provision it classifies, and each produces a real
// receipt naming the provisions that qualified.
//
// The three differ only in which conditions they require, which is the whole
// lesson: the answer depends on the definition, and the definition is editable.

const PILOT_DIR = "archive/pilots/eu-us-ai-evaluation-v1/original";
const PILOT_COMMITMENT_ID = "MODEL_EVALUATION_DUTY";
const PILOT_PROFILE = "reviewed";

/** The two jurisdictions the pilot covers, and the snapshot each maps to. */
export const PILOT_SUBJECTS: Readonly<Record<string, string>> = {
  eu: "EuropeanUnion",
  us: "UnitedStates",
};

const PILOT_SEEDS = [
  {
    id: "reviewed",
    file: "model-evaluation-duty.writ",
    title: "The reviewed rule",
    effect: "reviewed" as const,
    reading: "binding · applicable · provider · model evaluation",
    note: "All four conditions, as the human reviewers stated them. The European Union qualifies on one provision, Article 55(1)(a). The United States qualifies on none, though its agencies carry binding testing duties of their own.",
  },
  {
    id: "any-actor",
    file: "any-actor-any-force.writ",
    title: "Any organization, any legal force",
    effect: "flips" as const,
    reading: "drops binding · drops provider",
    note: "Stops asking whether the duty binds, and whom. The United States turns to yes on the NIST Generative AI Profile and CAISI\u2019s published guidelines, both of which are voluntary and neither of which anyone is required to follow.",
  },
  {
    id: "broad-conduct",
    file: "broad-conduct.writ",
    title: "Any duty near evaluation",
    effect: "widens" as const,
    reading: "drops model evaluation",
    note: "Stops asking what the duty is about. Both verdicts hold, which is what makes it the harder error to catch: the European Union's evidence goes from one provision to nine, now counting documentation and incident reporting as model evaluation.",
  },
  {
    id: "incomplete",
    file: "incomplete-score.writ",
    title: "A band left out",
    effect: "gap" as const,
    reading: "no rule for the empty case",
    note: "The same conditions, but the score program says nothing about a jurisdiction with no binding duty at all. The analyzer finds it before any evidence loads, which matters because both jurisdictions here would have masked it.",
  },
] as const;

export interface PilotExample {
  readonly id: string;
  readonly title: string;
  /** What this reading does to the answer, relative to the reviewed rule. */
  readonly effect: "reviewed" | "flips" | "widens" | "gap";
  readonly reading: string;
  readonly note: string;
  readonly source: string;
}

let pilotExamplesCache: readonly PilotExample[] | undefined;

export function loadPilotExamples(): readonly PilotExample[] {
  if (pilotExamplesCache === undefined) {
    pilotExamplesCache = PILOT_SEEDS.map((seed) => ({
      id: seed.id,
      title: seed.title,
      effect: seed.effect,
      reading: seed.reading,
      note: seed.note,
      source: readRepoText(`${PILOT_DIR}/methodology/${seed.file}`),
    }));
  }
  return pilotExamplesCache;
}

export function pilotExampleSource(id: string): string | undefined {
  return loadPilotExamples().find((example) => example.id === id)?.source;
}

/**
 * The snapshot the Lab is evaluating against, shaped for display: one entry per
 * provision, carrying the classification the rule tests and the retrieved text
 * the classification rests on.
 */
export function pilotEvidenceView(jurisdiction: string): PilotEvidenceView | undefined {
  if (!(jurisdiction in PILOT_SUBJECTS)) return undefined;
  const snapshot = readRepoJson<Evidence>(`${PILOT_DIR}/evidence/${jurisdiction}.snapshot.json`);
  const passages = new Map(snapshot.passages.map((passage) => [passage.id, passage]));
  const reviews = new Map(
    (snapshot.reviews ?? []).map((review) => [String(review.object_id), review]),
  );

  return {
    snapshotId: snapshot.snapshot.id,
    frozenAt: snapshot.snapshot.frozen_at,
    cutoff: snapshot.snapshot.cutoff,
    contentHash: snapshot.snapshot.content_hash,
    actions: snapshot.claims.map((claim) => {
      const qualifiers = (claim.qualifiers ?? {}) as Record<string, string>;
      const passage = passages.get(claim.evidence_links[0]?.passage_id ?? "");
      const review = reviews.get(claim.id);
      return {
        id: qualifiers.row_id ?? claim.id,
        label: `${qualifiers.instrument ?? ""} ${qualifiers.source_locator ?? ""}`.trim(),
        // What the duty is about, which is the condition most often collapsed.
        badge: qualifiers.conduct_type?.replaceAll("_", " ") ?? null,
        detail: [qualifiers.legal_force, qualifiers.actor_type]
          .filter((part) => part !== undefined)
          .map((part) => part.replaceAll("_", " "))
          .join(" · "),
        passage: passage ? { page: passage.page_number ?? null, quote: passage.quote } : null,
        review: review
          ? { reviewerId: String(review.reviewer_id), decision: String(review.decision) }
          : null,
      };
    }),
  };
}

export interface PilotEvidenceView {
  readonly snapshotId: string;
  readonly frozenAt: string;
  readonly cutoff: string;
  readonly contentHash: string;
  readonly actions: readonly {
    readonly id: string;
    readonly label: string;
    readonly badge: string | null;
    readonly detail: string;
    readonly passage: { readonly page: number | null; readonly quote: string } | null;
    readonly review: { readonly reviewerId: string; readonly decision: string } | null;
  }[];
}

/** How much of the reviewed corpus reached the snapshots, and what did not. */
export function pilotCoverage(): Record<string, { actions: number; omitted: string[] }> {
  return readRepoJson(`${PILOT_DIR}/evidence/coverage.json`);
}

/**
 * Compile `source` and evaluate it against one jurisdiction's pilot snapshot.
 *
 * The snapshot holds only provisions traced to their source text, so a receipt
 * from here is computed over quoted law and nothing else. What was left out is
 * in `pilotCoverage()`, and the Lab shows it beside the result.
 */
export function evaluatePilot(source: string, jurisdiction: string): EvaluateResponse {
  const subject = PILOT_SUBJECTS[jurisdiction];
  if (subject === undefined) {
    return { ok: false, error: `Unknown jurisdiction "${jurisdiction}".` };
  }
  const compiled = compileSource(source, { fileName: "playground.writ" });
  if (compiled.ir === undefined) {
    return {
      ok: false,
      error: "Source did not compile to IR; fix the diagnostics before evaluating.",
      diagnostics: compiled.diagnostics,
    };
  }
  const snapshot = readRepoJson<Evidence>(`${PILOT_DIR}/evidence/${jurisdiction}.snapshot.json`);
  const profile = readRepoJson<InterpretationProfile>(
    `${PILOT_DIR}/profiles/${PILOT_PROFILE}.profile.json`,
  );
  const hasCommitment = compiled.ir.commitments.some((c) => c.id === PILOT_COMMITMENT_ID);
  try {
    const receipt = evaluateCommitment({
      ir: compiled.ir,
      ...(hasCommitment ? { commitmentId: PILOT_COMMITMENT_ID } : {}),
      // The pilot's profile governs no parameters, so the snapshot is evaluated
      // as retrieved. Nothing is reclassified on the way in.
      snapshot,
      subject,
      profile,
    });
    return { ok: true, member: jurisdiction, profile: PILOT_PROFILE, receipt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Evaluation failed." };
  }
}

// --- Compile ----------------------------------------------------------------

export interface CompileResponse {
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly schemaValid: boolean;
  readonly schemaErrors: readonly { instancePath: string; message: string }[];
  readonly ir?: CanonicalIr;
}

export function compile(source: string): CompileResponse {
  const result = compileSource(source, { fileName: "playground.writ" });
  return {
    diagnostics: result.diagnostics,
    schemaValid: result.schemaValid,
    schemaErrors: result.schemaErrors,
    ...(result.ir ? { ir: result.ir } : {}),
  };
}

// --- Analyze ----------------------------------------------------------------

export interface AnalyzeResponse {
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly findings: readonly Diagnostic[];
  readonly compiled: boolean;
}

export function analyze(source: string): AnalyzeResponse {
  const result = compileSource(source, { fileName: "playground.writ" });
  const findings: Diagnostic[] = [];
  if (result.ir) {
    for (const commitment of result.ir.commitments) {
      findings.push(...analyzeCommitment(commitment));
    }
  }
  return {
    diagnostics: result.diagnostics,
    findings,
    compiled: result.ir !== undefined,
  };
}

// --- Evaluate ---------------------------------------------------------------

export interface EvaluateResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly diagnostics?: readonly LanguageDiagnostic[];
  readonly member?: string;
  readonly profile?: string;
  readonly receipt?: EvaluationReceipt;
}

/** Verify a receipt's content hash (tamper detection). */
export function verify(receipt: EvaluationReceipt): {
  valid: boolean;
  expected: string;
  actual: string;
} {
  return verifyReceipt(receipt);
}
