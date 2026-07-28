import type { CanonicalIr, EvaluationReceipt } from "@writ/domain";

/**
 * Client-side mirrors of the site's JSON API response shapes. These are the
 * wire contracts of `app/api/*` — declared here (not imported from the server
 * `lib/toolchain`, which pulls in node-only code) so the playground bundle stays
 * client-safe. Types are erased at build; runtime access still goes through
 * `fetch`.
 */

/** Receipt substructures, derived from the one exported `EvaluationReceipt`. */
export type Proof = EvaluationReceipt["proof"];
export type ProofNode = Proof["nodes"][number];
export type RuleEvaluation = EvaluationReceipt["rule_evaluations"][number];
export type Truth = ProofNode["truth_value"];

export type Severity = "error" | "warning" | "info";

export interface SourceSpan {
  offset: number;
  length: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/** A source-mapped compile diagnostic (`/api/compile`, `/api/analyze`). */
export interface CompileDiagnostic {
  code: string;
  severity: Severity;
  message: string;
  span?: SourceSpan;
  objectId?: string;
}

/** A static score-analysis finding (`/api/analyze` → `findings`). */
export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  witness?: unknown;
  context?: Record<string, unknown>;
  location?: { objectId?: string };
}

export interface CompileResponse {
  diagnostics: CompileDiagnostic[];
  schemaValid: boolean;
  schemaErrors: { instancePath: string; message: string }[];
  ir?: CanonicalIr;
}

export interface AnalyzeResponse {
  diagnostics: CompileDiagnostic[];
  findings: Finding[];
  compiled: boolean;
}

export interface EvaluateResponse {
  ok: boolean;
  error?: string;
  diagnostics?: CompileDiagnostic[];
  member?: string;
  profile?: string;
  receipt?: EvaluationReceipt;
}

export interface VerifyResponse {
  valid: boolean;
  expected: string;
  actual: string;
}

/**
 * What a reading does to the answer, relative to the reviewed rule. All three
 * readings compile and analyze clean, so the interesting axis is not whether the
 * logic is well-formed but what loosening a condition does to the verdict.
 */
export type ExampleEffect = "reviewed" | "flips" | "widens" | "gap";

export interface PlaygroundExample {
  id: string;
  title: string;
  reading: string;
  effect: ExampleEffect;
  note: string;
  source: string;
}

export interface ExamplesResponse {
  examples: PlaygroundExample[];
}

/** The two members of the pilot methodology's declared subject set. */
export const MEMBERS = ["eu", "us"] as const;

export type Member = (typeof MEMBERS)[number];

export const MEMBER_LABELS: Record<Member, string> = {
  eu: "European Union",
  us: "United States",
};

/** Label a member id, falling back to a humanized form for anything unlisted. */
export function memberLabel(id: string): string {
  return (
    MEMBER_LABELS[id as Member] ??
    id
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

/**
 * The pilot's methodology governs no parameters, so there is one profile and
 * nothing to choose between. It is still named on the receipt, because "no
 * interpretive choices were made" is itself a claim worth being able to check.
 */
export type Profile = "reviewed";

export const PROFILE_LABELS: Record<Profile, string> = {
  reviewed: "Reviewed",
};

/** Score/truth values the receipt can carry, narrowed for the shared TruthBadge. */
export type BadgeableResult =
  "+1" | "0" | "-1" | "unresolved" | "true" | "false" | "unknown" | "contested";

/** Map a receipt `result` (which may be `not_applicable`) onto a badge value. */
export function badgeResult(result: string): BadgeableResult {
  switch (result) {
    case "+1":
    case "0":
    case "-1":
    case "unresolved":
      return result;
    default:
      return "unknown";
  }
}

/** One provision in the snapshot the Lab is evaluating against. */
export interface EvidenceAction {
  readonly id: string;
  readonly label: string;
  /** The classification shown beside the label. */
  readonly badge: string | null;
  /** Secondary detail: the legal force, the lifecycle stage, whatever fits. */
  readonly detail: string;
  readonly passage: { readonly page: number | null; readonly quote: string } | null;
  readonly review: { readonly reviewerId: string; readonly decision: string } | null;
}

export interface EvidenceView {
  readonly snapshotId: string;
  readonly frozenAt: string;
  readonly cutoff: string;
  readonly contentHash: string;
  readonly actions: readonly EvidenceAction[];
}
