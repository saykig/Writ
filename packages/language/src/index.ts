/**
 * `@writ/language` public API.
 *
 * The Writ compiler front end: a Langium grammar and generated parser (with
 * error recovery), an idempotent formatter, and native record lowering.
 * Everything is pure and deterministic and
 * never imports `@writ/api` or touches a database.
 */

import type { RecordJudgment, WritRecord } from "@writ/domain";
import { validateVersion } from "@writ/domain";
import type { Model } from "./generated/ast.js";
import { parseDocument, type ParsedDocument } from "./parse.js";
import { compileModel, type CompileResult, type SourceMapEntry } from "./compile.js";
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
export {
  compileModel,
  normalizeTopic,
  type CompileResult,
  type CompileOptions,
  type SourceMapEntry,
} from "./compile.js";
export { formatText, printModel, printLiteral } from "./format.js";
export {
  hasErrors,
  sortDiagnostics,
  compareDiagnostics,
  type LanguageDiagnostic,
  type DiagnosticSeverity,
  type SourceSpan,
} from "./diagnostics.js";
export { TOPIC_ALIASES } from "./topic-aliases.js";
export * from "./generated/ast.js";

/** The full outcome of the compile pipeline for one document. */
export interface CompileSourceResult {
  /** The parsed AST root. */
  readonly model: Model;
  /** Parse and lowering diagnostics, sorted by source order. */
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly records: readonly WritRecord[];
  readonly judgments: readonly RecordJudgment[];
  /** Out-of-band node→span source map. */
  readonly sourceMap: readonly SourceMapEntry[];
  /** True when every compiled native artifact validates against its contract. */
  readonly schemaValid: boolean;
  /** Schema validation issues (empty when `schemaValid`). */
  readonly schemaErrors: readonly { instancePath: string; message: string }[];
}

/**
 * Parse and lower one source document, then validate every native record and
 * judgment against its declared contract.
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
      records: [],
      judgments: [],
      schemaValid: false,
      schemaErrors: [],
    };
  }

  const compiled: CompileResult = compileModel(parsed.model);
  diagnostics.push(...compiled.diagnostics);

  const validations = [
    ...compiled.records.map((record) => {
      const artifact =
        record.family === "legal_policy"
          ? "legal-policy-record"
          : record.family === "institutional"
            ? "institutional-record"
            : "record";
      return {
        artifact,
        result: validateVersion(artifact, record, record.schema_version),
      };
    }),
    ...compiled.judgments.map((judgment) => ({
      artifact: "record-judgment",
      result: validateVersion("record-judgment", judgment, judgment.schema_version),
    })),
  ];
  const schemaValid = validations.every((validation) => validation.result.valid);
  const schemaErrors = validations.flatMap(({ artifact, result }) =>
    result.valid
      ? []
      : result.errors.map((issue) => ({
          instancePath: issue.instancePath,
          message: `${artifact}: ${issue.message}${typeof issue.params.missingProperty === "string" ? ` ${issue.params.missingProperty}` : ""}`,
        })),
  );

  return {
    model: parsed.model,
    diagnostics: sortDiagnostics(diagnostics),
    records: compiled.records,
    judgments: compiled.judgments,
    sourceMap: compiled.sourceMap,
    schemaValid,
    schemaErrors,
  };
}

/** Convenience: `true` when a source document has no error-level diagnostics. */
export function isClean(result: CompileSourceResult): boolean {
  return !hasErrors(result.diagnostics);
}
