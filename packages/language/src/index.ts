/**
 * `@writ/language` public API.
 *
 * The Writ compiler front end: a Langium grammar and generated parser (with
 * error recovery), symbol linking + type checking, an idempotent formatter, and
 * an AST→canonical-IR lowering pass. Everything is pure and deterministic and
 * never imports `@writ/api` or touches a database.
 */

import type { CanonicalIr } from "@writ/domain";
import { validate } from "@writ/domain";
import type { Model } from "./generated/ast.js";
import { parseDocument, type ParsedDocument } from "./parse.js";
import { checkModel } from "./checker.js";
import {
  compileModel,
  type CompileResult,
  type ResolvedImport,
  type SourceMapEntry,
} from "./compile.js";
import { sortDiagnostics, hasErrors, type LanguageDiagnostic } from "./diagnostics.js";

export { createWritServices, type WritServices } from "./writ-module.js";
export {
  parseDocument,
  spanFromCst,
  spanOf,
  extractLiterate,
  isLiterateFile,
  type ParsedDocument,
} from "./parse.js";
export { checkModel, type CheckResult, type ModelScopes } from "./checker.js";
export {
  compileModel,
  type CompileResult,
  type CompileOptions,
  type SourceMapEntry,
  type ResolvedImport,
} from "./compile.js";
export { formatText, printModel, printExpr } from "./format.js";
export {
  hasErrors,
  sortDiagnostics,
  compareDiagnostics,
  type LanguageDiagnostic,
  type DiagnosticSeverity,
  type SourceSpan,
} from "./diagnostics.js";
export { PRELUDE_SETS, PRELUDE_ISSUE_AREAS } from "./prelude.js";
export * from "./generated/ast.js";

/** The full outcome of the compile pipeline for one document. */
export interface CompileSourceResult {
  /** The parsed AST root. */
  readonly model: Model;
  /** Parse + link + type-check + lowering diagnostics, sorted by source order. */
  readonly diagnostics: readonly LanguageDiagnostic[];
  /** The canonical IR (best-effort even when non-fatal diagnostics exist). */
  readonly ir?: CanonicalIr;
  /** Out-of-band node→span source map. */
  readonly sourceMap: readonly SourceMapEntry[];
  /** Resolved import lock. */
  readonly importLock: readonly ResolvedImport[];
  /** True when the IR validates against the `canonical-ir` schema. */
  readonly schemaValid: boolean;
  /** Schema validation issues (empty when `schemaValid`). */
  readonly schemaErrors: readonly { instancePath: string; message: string }[];
}

/**
 * Parse, link, type-check, and lower one source document to canonical IR, then
 * validate the IR against the `canonical-ir` schema. Syntactic failure short
 * circuits (no IR is produced); semantic diagnostics do not block lowering so
 * tooling can show findings alongside a best-effort IR.
 */
export function compileSource(
  text: string,
  options: { readonly literate?: boolean; readonly fileName?: string } = {},
): CompileSourceResult {
  const parsed: ParsedDocument = parseDocument(text, options);
  const diagnostics: LanguageDiagnostic[] = [...parsed.diagnostics];

  if (!parsed.ok) {
    return {
      model: parsed.model,
      diagnostics: sortDiagnostics(diagnostics),
      sourceMap: [],
      importLock: [],
      schemaValid: false,
      schemaErrors: [],
    };
  }

  const checked = checkModel(parsed.model);
  diagnostics.push(...checked.diagnostics);

  const compiled: CompileResult = compileModel(parsed.model);
  diagnostics.push(...compiled.diagnostics);

  const ir = compiled.ir;
  const validation = ir ? validate("canonical-ir", ir) : { valid: false, errors: [] as const };

  return {
    model: parsed.model,
    diagnostics: sortDiagnostics(diagnostics),
    ...(ir ? { ir } : {}),
    sourceMap: compiled.sourceMap,
    importLock: compiled.importLock,
    schemaValid: validation.valid,
    schemaErrors: validation.valid
      ? []
      : validation.errors.map((issue) => ({
          instancePath: issue.instancePath,
          message: issue.message,
        })),
  };
}

/** Convenience: `true` when a source document has no error-level diagnostics. */
export function isClean(result: CompileSourceResult): boolean {
  return !hasErrors(result.diagnostics);
}
