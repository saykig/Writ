/**
 * Turn Writ source text into a typed AST.
 *
 * Parsing uses the generated Langium (Chevrotain) parser, which recovers from
 * errors and reports every lexer/parser fault with a token span. We translate
 * those faults into {@link LanguageDiagnostic}s that point at exact source
 * offsets. Literate `.writ.md` files are masked (prose replaced by
 * offset-preserving whitespace) so diagnostic spans still refer to the original
 * document.
 */

import type { AstNode, CstNode, ParseResult } from "langium";
import type { Model } from "./generated/ast.js";
import { createWritServices } from "./writ-module.js";
import type { LanguageDiagnostic, SourceSpan } from "./diagnostics.js";

/** The outcome of parsing one document. */
export interface ParsedDocument {
  /** The root AST node. Present even on failure (partial recovery tree). */
  readonly model: Model;
  /** Syntax diagnostics (lexer + parser errors), in source order. */
  readonly diagnostics: readonly LanguageDiagnostic[];
  /** True when there were no lexer or parser errors. */
  readonly ok: boolean;
}

/** Build a {@link SourceSpan} from a Langium CST node. */
export function spanFromCst(node: CstNode): SourceSpan {
  return {
    offset: node.offset,
    length: node.length,
    startLine: node.range.start.line + 1,
    startColumn: node.range.start.character + 1,
    endLine: node.range.end.line + 1,
    endColumn: node.range.end.character + 1,
  };
}

/** Best-effort span for an AST node; `undefined` if it has no CST backing. */
export function spanOf(node: AstNode | undefined): SourceSpan | undefined {
  const cst = node?.$cstNode;
  return cst ? spanFromCst(cst) : undefined;
}

interface ChevToken {
  readonly startOffset: number;
  readonly endOffset?: number;
  readonly startLine?: number;
  readonly startColumn?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly image?: string;
}

function spanFromToken(token: ChevToken | undefined, fallbackLength = 1): SourceSpan | undefined {
  if (!token || typeof token.startOffset !== "number" || Number.isNaN(token.startOffset)) {
    return undefined;
  }
  const start = token.startOffset;
  const end = typeof token.endOffset === "number" ? token.endOffset : start + fallbackLength - 1;
  return {
    offset: start,
    length: Math.max(1, end - start + 1),
    startLine: token.startLine ?? 1,
    startColumn: token.startColumn ?? 1,
    endLine: token.endLine ?? token.startLine ?? 1,
    endColumn: token.endColumn ?? (token.startColumn ?? 0) + Math.max(0, end - start),
  };
}

/**
 * Mask a literate `.writ.md` document: every character outside a fenced
 * ```writ block (including the fence lines themselves) is replaced by a
 * space, and newlines are preserved. The result parses as plain Writ while
 * keeping every retained character at its original offset, so diagnostics map
 * straight back to the `.writ.md` file.
 */
export function extractLiterate(markdown: string): string {
  const lines = markdown.split(/(?<=\n)/); // keep the trailing newline on each line
  let inside = false;
  const out: string[] = [];
  const blank = (line: string): string => line.replace(/[^\n]/g, " ");
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!inside && /^```+\s*writ\b/.test(trimmed)) {
      inside = true;
      out.push(blank(line)); // drop the opening fence
      continue;
    }
    if (inside && /^```+\s*$/.test(trimmed)) {
      inside = false;
      out.push(blank(line)); // drop the closing fence
      continue;
    }
    out.push(inside ? line : blank(line));
  }
  return out.join("");
}

/** True for a document whose content should be treated as literate Markdown. */
export function isLiterateFile(fileName: string): boolean {
  return fileName.endsWith(".writ.md");
}

/**
 * Parse `text` into a Writ AST. Pass `{ literate: true }` (or a `.writ.md`
 * file name) to first mask Markdown prose.
 */
export function parseDocument(
  text: string,
  options: { readonly literate?: boolean; readonly fileName?: string } = {},
): ParsedDocument {
  const literate =
    options.literate ?? (options.fileName ? isLiterateFile(options.fileName) : false);
  const source = literate ? extractLiterate(text) : text;

  const { Writ } = createWritServices();
  const result: ParseResult<Model> = Writ.parser.LangiumParser.parse<Model>(source);

  const diagnostics: LanguageDiagnostic[] = [];
  for (const error of result.lexerErrors) {
    const token = error as unknown as {
      offset: number;
      length?: number;
      line?: number;
      column?: number;
      message: string;
    };
    const span: SourceSpan | undefined =
      typeof token.offset === "number" && !Number.isNaN(token.offset)
        ? {
            offset: token.offset,
            length: Math.max(1, token.length ?? 1),
            startLine: token.line ?? 1,
            startColumn: token.column ?? 1,
            endLine: token.line ?? 1,
            endColumn: (token.column ?? 1) + Math.max(0, (token.length ?? 1) - 1),
          }
        : undefined;
    diagnostics.push({
      code: "WRT-LEX-ERROR",
      severity: "error",
      message: error.message,
      ...(span ? { span } : {}),
    });
  }
  for (const error of result.parserErrors) {
    const span = spanFromToken(error.token as unknown as ChevToken);
    diagnostics.push({
      code: "WRT-PARSE-ERROR",
      severity: "error",
      message: error.message,
      ...(span ? { span } : {}),
    });
  }

  return {
    model: result.value,
    diagnostics,
    ok: result.lexerErrors.length === 0 && result.parserErrors.length === 0,
  };
}
