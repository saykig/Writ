import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  compileSource,
  formatText,
  sortDiagnostics,
  type CompileSourceResult,
  type LanguageDiagnostic,
} from "@writ/language";
import type { CliIO } from "./io.js";

const read = (file: string): string => readFileSync(file, "utf8");
const isLiterate = (file: string): boolean => file.endsWith(".writ.md");
const errorCount = (diagnostics: readonly LanguageDiagnostic[]): number =>
  diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

function formatDiagnosticLine(file: string, diagnostic: LanguageDiagnostic): string {
  const where = diagnostic.span
    ? `${file}:${diagnostic.span.startLine}:${diagnostic.span.startColumn}`
    : file;
  return `${where}: ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`;
}

export function runFmt(args: readonly string[], io: CliIO): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      write: { type: "boolean", default: false },
      check: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  if (positionals.length === 0) {
    io.err("error: fmt requires at least one file");
    return 2;
  }
  let changed = 0;
  for (const file of positionals) {
    const original = read(file);
    const formatted = formatText(original, { literate: isLiterate(file) });
    if (values.check) {
      if (formatted !== original) {
        changed += 1;
        io.err(`not formatted: ${file}`);
      }
    } else if (values.write) {
      if (formatted !== original) {
        writeFileSync(file, formatted);
        io.out(`formatted ${file}`);
      }
    } else {
      io.out(formatted);
    }
  }
  return values.check && changed > 0 ? 1 : 0;
}

interface FileCheck {
  readonly file: string;
  readonly result: CompileSourceResult;
}

function checkFiles(files: readonly string[]): FileCheck[] {
  return files.map((file) => ({
    file,
    result: compileSource(read(file), { literate: isLiterate(file), fileName: file }),
  }));
}

export function runCheck(args: readonly string[], io: CliIO): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { json: { type: "boolean", default: false } },
    allowPositionals: true,
  });
  if (positionals.length === 0) {
    io.err("error: check requires at least one file");
    return 2;
  }
  const checks = checkFiles(positionals);
  let errors = 0;
  if (values.json) {
    io.out(
      JSON.stringify(
        checks.map(({ file, result }) => ({
          file,
          schemaValid: result.schemaValid,
          diagnostics: sortDiagnostics(result.diagnostics),
        })),
        null,
        2,
      ),
    );
    return checks.some(({ result }) => errorCount(result.diagnostics) > 0 || !result.schemaValid)
      ? 1
      : 0;
  }
  for (const { file, result } of checks) {
    for (const diagnostic of sortDiagnostics(result.diagnostics)) {
      const line = formatDiagnosticLine(file, diagnostic);
      if (diagnostic.severity === "error") io.err(line);
      else io.out(line);
    }
    errors += errorCount(result.diagnostics);
    if (!result.schemaValid) {
      errors += 1;
      io.err(`${file}: error WRT-RECORD-INVALID: compiled native artifacts did not validate`);
      for (const issue of result.schemaErrors.slice(0, 8))
        io.err(`  ${issue.instancePath || "/"}: ${issue.message}`);
    } else {
      io.out(`${file}: ok`);
    }
  }
  return errors > 0 ? 1 : 0;
}

export function runCompile(args: readonly string[], io: CliIO): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { out: { type: "string" }, json: { type: "boolean", default: false } },
    allowPositionals: true,
  });
  const file = positionals[0];
  if (file === undefined) {
    io.err("error: compile requires a source file");
    return 2;
  }
  const result = compileSource(read(file), { literate: isLiterate(file), fileName: file });
  for (const diagnostic of sortDiagnostics(result.diagnostics))
    if (diagnostic.severity === "error") io.err(formatDiagnosticLine(file, diagnostic));
  if (errorCount(result.diagnostics) > 0 || !result.schemaValid) {
    io.err(`error: ${file} did not compile to valid native artifacts`);
    for (const issue of result.schemaErrors.slice(0, 8))
      io.err(`  ${issue.instancePath || "/"}: ${issue.message}`);
    return 1;
  }
  const json = JSON.stringify({ records: result.records, judgments: result.judgments }, null, 2);
  if (values.out) {
    writeFileSync(values.out, `${json}\n`);
    io.out(`wrote ${values.out}`);
  } else {
    io.out(json);
  }
  return 0;
}
