/**
 * Language subcommands for the Covenant CLI: `fmt`, `check`, `compile`,
 * `analyze`, and `test`. These drive the `@covenant/language` front end and the
 * `@covenant/analyzer` bounded score analysis over compiled IR. All output is
 * deterministic; `--json` produces stable, sorted payloads suitable for CI.
 */

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import {
  compileSource,
  formatText,
  sortDiagnostics,
  type CompileSourceResult,
  type LanguageDiagnostic,
  type Model,
  type Scenario,
} from "@covenant/language";
import type { CanonicalIr, Commitment } from "@covenant/domain";
import { analyzeCommitment, runScenario, type ScenarioResult } from "./analysis.js";
import type { CliIO } from "./io.js";

function isLiterate(file: string): boolean {
  return file.endsWith(".covenant.md");
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

function formatDiagnosticLine(file: string, diagnostic: LanguageDiagnostic): string {
  const where = diagnostic.span
    ? `${file}:${diagnostic.span.startLine}:${diagnostic.span.startColumn}`
    : file;
  return `${where}: ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`;
}

function errorCount(diagnostics: readonly LanguageDiagnostic[]): number {
  return diagnostics.filter((d) => d.severity === "error").length;
}

// --- fmt --------------------------------------------------------------------

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
      continue;
    }
    if (values.write) {
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

// --- check ------------------------------------------------------------------

interface FileCheck {
  readonly file: string;
  readonly result: CompileSourceResult;
}

function checkFiles(files: readonly string[]): FileCheck[] {
  return files.map((file) => ({
    file,
    result: compileSource(read(file), { literate: isLiterate(file) }),
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
    const payload = checks.map(({ file, result }) => ({
      file,
      schemaValid: result.schemaValid,
      diagnostics: sortDiagnostics(result.diagnostics),
    }));
    io.out(JSON.stringify(payload, null, 2));
    for (const { result } of checks) errors += errorCount(result.diagnostics);
    return errors > 0 ? 1 : 0;
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
      io.err(`${file}: error COV-IR-INVALID: compiled IR did not validate against canonical-ir`);
      for (const issue of result.schemaErrors.slice(0, 8)) {
        io.err(`  ${issue.instancePath || "/"}: ${issue.message}`);
      }
    } else {
      io.out(`${file}: ok`);
    }
  }
  return errors > 0 ? 1 : 0;
}

// --- compile ----------------------------------------------------------------

export function runCompile(args: readonly string[], io: CliIO): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      out: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  const file = positionals[0];
  if (file === undefined) {
    io.err("error: compile requires a source file");
    return 2;
  }
  const result = compileSource(read(file), { literate: isLiterate(file) });
  for (const diagnostic of sortDiagnostics(result.diagnostics)) {
    if (diagnostic.severity === "error") io.err(formatDiagnosticLine(file, diagnostic));
  }
  if (!result.ir || errorCount(result.diagnostics) > 0) {
    io.err(`error: ${file} did not compile`);
    return 1;
  }
  if (!result.schemaValid) {
    io.err(`error: ${file} compiled to IR that failed canonical-ir validation`);
    for (const issue of result.schemaErrors.slice(0, 8)) {
      io.err(`  ${issue.instancePath || "/"}: ${issue.message}`);
    }
    return 1;
  }
  const json = JSON.stringify(result.ir, null, 2);
  if (values.out) {
    writeFileSync(values.out, json + "\n");
    io.out(`wrote ${values.out}`);
  } else {
    io.out(json);
  }
  return 0;
}

// --- analyze ----------------------------------------------------------------

function irCommitments(ir: CanonicalIr): readonly Commitment[] {
  return ir.commitments;
}

export function runAnalyze(args: readonly string[], io: CliIO): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { json: { type: "boolean", default: false } },
    allowPositionals: true,
  });
  const file = positionals[0];
  if (file === undefined) {
    io.err("error: analyze requires a source file");
    return 2;
  }
  const result = compileSource(read(file), { literate: isLiterate(file) });
  if (!result.ir || errorCount(result.diagnostics) > 0) {
    for (const diagnostic of sortDiagnostics(result.diagnostics)) {
      if (diagnostic.severity === "error") io.err(formatDiagnosticLine(file, diagnostic));
    }
    io.err(`error: ${file} did not compile; cannot analyze`);
    return 1;
  }

  const findings = irCommitments(result.ir).flatMap((commitment) => analyzeCommitment(commitment));

  if (values.json) {
    io.out(JSON.stringify(findings, null, 2));
  } else {
    if (findings.length === 0) {
      io.out(`${file}: no score-analysis findings`);
    }
    for (const finding of findings) {
      const object = finding.location?.objectId ? ` [${finding.location.objectId}]` : "";
      io.out(`${finding.severity} ${finding.code}${object}: ${finding.message}`);
    }
  }
  return findings.some((finding) => finding.severity === "error") ? 1 : 0;
}

// --- test -------------------------------------------------------------------

function scenariosOf(model: Model): Scenario[] {
  return model.declarations.filter((d): d is Scenario => d.$type === "Scenario");
}

export function runTest(args: readonly string[], io: CliIO): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { json: { type: "boolean", default: false } },
    allowPositionals: true,
  });
  if (positionals.length === 0) {
    io.err("error: test requires at least one file");
    return 2;
  }

  const results: (ScenarioResult & { file: string })[] = [];
  let hardErrors = 0;

  for (const file of positionals) {
    const compiled = compileSource(read(file), { literate: isLiterate(file) });
    if (!compiled.ir) {
      hardErrors += 1;
      io.err(`error: ${file} did not compile; cannot run scenarios`);
      continue;
    }
    const byId = new Map(compiled.ir.commitments.map((c) => [c.id, c] as const));
    for (const scenario of scenariosOf(compiled.model)) {
      const commitment = byId.get(scenario.commitment);
      if (!commitment) {
        hardErrors += 1;
        io.err(
          `error: scenario ${scenario.name} targets unknown commitment ${scenario.commitment}`,
        );
        continue;
      }
      results.push({ file, ...runScenario(scenario, commitment) });
    }
  }

  const failures = results.filter((r) => !r.pass).length;

  if (values.json) {
    io.out(JSON.stringify({ results, failures, hardErrors }, null, 2));
  } else {
    for (const result of results) {
      const status = result.pass ? "PASS" : "FAIL";
      io.out(
        `${status} ${result.file} ${result.scenario} (${result.kind}): expected ${result.expected}, got ${result.actual}`,
      );
    }
    io.out("");
    io.out(`${results.length - failures}/${results.length} scenarios passed`);
  }
  return failures > 0 || hardErrors > 0 ? 1 : 0;
}
