/**
 * Source-level diagnostics for the Writ toolchain.
 *
 * These are distinct from the IR-level `@writ/domain` `Diagnostic` (which has
 * no source span): a `LanguageDiagnostic` points at an exact span in the source
 * text so editors and CI can underline the offending token. The JSON form is
 * stable and sorted so CI output does not churn.
 */

/** Zero-based offset span plus 1-based line/column for editor display. */
export interface SourceSpan {
  readonly offset: number;
  readonly length: number;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

export type DiagnosticSeverity = "error" | "warning" | "info";

/** A single source-mapped finding. */
export interface LanguageDiagnostic {
  /** Stable machine code, e.g. `WRT-PARSE-ERROR`, `WRT-LINK-UNDEFINED`. */
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  /** Absent only for whole-document findings that have no natural span. */
  readonly span?: SourceSpan;
  /** Optional id of the governed object (commitment, rule, …) the finding is about. */
  readonly objectId?: string;
}

/** True when any diagnostic is an error. */
export function hasErrors(diagnostics: readonly LanguageDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

/**
 * A total order on diagnostics: by span start, then severity, then code, then
 * message. Deterministic so serialized CI output is stable across runs.
 */
export function compareDiagnostics(a: LanguageDiagnostic, b: LanguageDiagnostic): number {
  const ao = a.span?.offset ?? -1;
  const bo = b.span?.offset ?? -1;
  if (ao !== bo) return ao - bo;
  const al = a.span?.length ?? -1;
  const bl = b.span?.length ?? -1;
  if (al !== bl) return al - bl;
  const severityRank: Record<DiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };
  if (severityRank[a.severity] !== severityRank[b.severity]) {
    return severityRank[a.severity] - severityRank[b.severity];
  }
  if (a.code !== b.code) return a.code.localeCompare(b.code);
  return a.message.localeCompare(b.message);
}

/** Return a new, sorted array (never mutates the input). */
export function sortDiagnostics(diagnostics: readonly LanguageDiagnostic[]): LanguageDiagnostic[] {
  return [...diagnostics].sort(compareDiagnostics);
}
