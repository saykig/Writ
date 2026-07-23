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

export type ExampleOutcome = "gap" | "overlap" | "clean";

export interface PlaygroundExample {
  id: string;
  title: string;
  reading: string;
  outcome: ExampleOutcome;
  note: string;
  source: string;
}

export interface ExamplesResponse {
  examples: PlaygroundExample[];
}

/** The eight G7 members the evaluator accepts, in benchmark display order. */
export const MEMBERS = [
  "canada",
  "france",
  "germany",
  "italy",
  "japan",
  "united_kingdom",
  "united_states",
  "european_union",
] as const;

export type Member = (typeof MEMBERS)[number];

export const MEMBER_LABELS: Record<Member, string> = {
  canada: "Canada",
  france: "France",
  germany: "Germany",
  italy: "Italy",
  japan: "Japan",
  united_kingdom: "United Kingdom",
  united_states: "United States",
  european_union: "European Union",
};

export type Profile = "published" | "generous";

export const PROFILE_LABELS: Record<Profile, string> = {
  published: "Published",
  generous: "Generous",
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
