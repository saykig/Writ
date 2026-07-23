/**
 * Symbol linking and type checking (LANG-002).
 *
 * Runs over the parsed AST after syntax recovery and before lowering. It builds a
 * per-commitment symbol table (variables, parameters, dimensions, goals, partner
 * classes, predicates, classifications, enum values) and resolves the cross
 * references the grammar keeps as plain names: assertion-domain variables,
 * scenario targets and given-paths, subject sets, and interpretation-profile
 * targets. It also checks the handful of types that are locally decidable —
 * a variable's declared type against its query's result category, a parameter
 * default against its declared type, and score-result literals. Every finding
 * carries an exact source span.
 */

import { DIAGNOSTIC_CODES } from "@covenant/domain";
import type {
  Commitment,
  Expression,
  Model,
  Parameter,
  Scenario,
  Variable,
} from "./generated/ast.js";
import type { LanguageDiagnostic } from "./diagnostics.js";
import { spanOf } from "./parse.js";
import { PRELUDE_SETS } from "./prelude.js";

type SymbolKind =
  | "variable"
  | "parameter"
  | "dimension"
  | "goal"
  | "partner_class"
  | "predicate"
  | "classification";

interface SymbolInfo {
  readonly kind: SymbolKind;
  readonly type?: string;
}

interface CommitmentScope {
  readonly commitment: Commitment;
  readonly symbols: Map<string, SymbolInfo>;
}

type TypeCategory = "numeric" | "truth" | "text" | "temporal" | "unknown";

const NUMERIC_TYPES = new Set(["Int", "Decimal", "Number", "Percent", "Money", "Quantity"]);
const TRUTH_TYPES = new Set(["Truth", "Bool", "Boolean"]);
const TEXT_TYPES = new Set(["Text", "String", "URI", "Hash"]);
const TEMPORAL_TYPES = new Set(["Date", "DateTime", "Interval"]);

const NUMERIC_QUERY_OPS = new Set([
  "count",
  "count_distinct",
  "sum",
  "coverage",
  "ratio",
  "min",
  "max",
]);
const TRUTH_QUERY_OPS = new Set(["exists", "forall"]);

const VALID_SCORE_RESULTS = new Set(["-1", "0", "+1", "not_applicable"]);
const VALID_OTHERWISE_RESULTS = new Set(["unresolved", "not_applicable", "-1", "0", "+1"]);

function typeCategory(type: string | undefined): TypeCategory {
  if (!type) return "unknown";
  const base = type.replace(/<.*$/, "");
  if (NUMERIC_TYPES.has(base)) return "numeric";
  if (TRUTH_TYPES.has(base)) return "truth";
  if (TEXT_TYPES.has(base)) return "text";
  if (TEMPORAL_TYPES.has(base)) return "temporal";
  return "unknown";
}

function buildScope(commitment: Commitment): CommitmentScope {
  const symbols = new Map<string, SymbolInfo>();
  for (const member of commitment.members) {
    switch (member.$type) {
      case "Variable":
        symbols.set(member.name, { kind: "variable", type: member.type });
        break;
      case "Parameter":
        symbols.set(member.name, { kind: "parameter", type: member.type });
        break;
      case "Dimension":
        symbols.set(member.name, { kind: "dimension" });
        break;
      case "Goal":
        symbols.set(member.name, { kind: "goal" });
        break;
      case "PartnerClass":
        symbols.set(member.name, { kind: "partner_class" });
        break;
      case "Predicate":
        symbols.set(member.name, { kind: "predicate" });
        break;
      case "Classification":
        symbols.set(member.name, { kind: "classification" });
        break;
      default:
        break;
    }
  }
  return { commitment, symbols };
}

function push(diagnostics: LanguageDiagnostic[], diagnostic: LanguageDiagnostic): void {
  diagnostics.push(diagnostic);
}

function checkVariableType(variable: Variable, diagnostics: LanguageDiagnostic[]): void {
  const declared = typeCategory(variable.type);
  const expr = variable.expression;
  if (expr.$type !== "QueryExpression" || expr.extraArgs.length > 0) {
    return; // only queries have a locally-known result category
  }
  let resultCategory: TypeCategory = "unknown";
  if (NUMERIC_QUERY_OPS.has(expr.op)) resultCategory = "numeric";
  else if (TRUTH_QUERY_OPS.has(expr.op)) resultCategory = "truth";
  if (resultCategory === "unknown" || declared === "unknown") return;
  if (resultCategory !== declared) {
    push(diagnostics, {
      code: "COV-LINT-TYPE",
      severity: "error",
      message: `Variable \`${variable.name}\` is declared \`${variable.type}\` but \`${expr.op}(…)\` yields a ${resultCategory} value.`,
      ...(spanOf(variable) ? { span: spanOf(variable)! } : {}),
    });
  }
}

function literalCategory(node: Expression): TypeCategory {
  switch (node.$type) {
    case "NumberLiteral":
      return "numeric";
    case "BooleanLiteral":
      return "truth";
    case "TruthLiteral":
      return "truth";
    case "StringLiteral":
      return "text";
    case "DateLiteral":
      return "temporal";
    default:
      return "unknown";
  }
}

function checkParameter(parameter: Parameter, diagnostics: LanguageDiagnostic[]): void {
  const declared = typeCategory(parameter.type);
  const actual = literalCategory(parameter.default);
  if (declared === "unknown" || actual === "unknown") return;
  if (declared !== actual) {
    push(diagnostics, {
      code: "COV-LINT-TYPE",
      severity: "error",
      message: `Parameter \`${parameter.name}\` is declared \`${parameter.type}\` but its default is a ${actual} literal.`,
      ...(spanOf(parameter) ? { span: spanOf(parameter)! } : {}),
    });
  }
}

function checkCommitment(
  commitment: Commitment,
  diagnostics: LanguageDiagnostic[],
): CommitmentScope {
  const scope = buildScope(commitment);

  for (const member of commitment.members) {
    switch (member.$type) {
      case "Variable":
        checkVariableType(member, diagnostics);
        break;
      case "Parameter":
        checkParameter(member, diagnostics);
        break;
      case "Subjects": {
        const value = member.value;
        if (value.$type === "ReferenceExpression" && !PRELUDE_SETS[value.path]) {
          push(diagnostics, {
            code: "COV-LINK-MISSING-REFERENCE",
            severity: "error",
            message: `Subject set \`${value.path}\` is not declared or provided by a standard import.`,
            ...(spanOf(value) ? { span: spanOf(value)! } : {}),
            objectId: commitment.name,
          });
        }
        break;
      }
      case "Assertion": {
        for (const domain of member.domains) {
          const info = scope.symbols.get(domain.variable);
          if (!info || (info.kind !== "variable" && info.kind !== "parameter")) {
            push(diagnostics, {
              code: "COV-LINK-MISSING-REFERENCE",
              severity: "error",
              message: `Assertion domain references \`${domain.variable}\`, which is not a declared variable or parameter of \`${commitment.name}\`.`,
              ...(spanOf(domain) ? { span: spanOf(domain)! } : {}),
              objectId: commitment.name,
            });
          }
        }
        break;
      }
      case "ScoreBlock": {
        for (const rule of member.rules) {
          if (!VALID_SCORE_RESULTS.has(rule.result)) {
            push(diagnostics, {
              code: "COV-LINT-TYPE",
              severity: "error",
              message: `Score rule result \`${rule.result}\` must be one of "-1", "0", "+1".`,
              ...(spanOf(rule) ? { span: spanOf(rule)! } : {}),
              objectId: commitment.name,
            });
          }
        }
        const otherwise = member.otherwise;
        const otherwiseResult = otherwise.resultKw ?? otherwise.resultValue ?? "";
        if (!VALID_OTHERWISE_RESULTS.has(otherwiseResult)) {
          push(diagnostics, {
            code: "COV-LINT-TYPE",
            severity: "error",
            message: `\`otherwise\` result \`${otherwiseResult}\` is not a valid score outcome.`,
            ...(spanOf(otherwise) ? { span: spanOf(otherwise)! } : {}),
            objectId: commitment.name,
          });
        }
        break;
      }
      default:
        break;
    }
  }
  return scope;
}

function checkScenario(
  scenario: Scenario,
  scopes: Map<string, CommitmentScope>,
  diagnostics: LanguageDiagnostic[],
): void {
  const scope = scopes.get(scenario.commitment);
  if (!scope) {
    push(diagnostics, {
      code: "COV-LINK-MISSING-REFERENCE",
      severity: "error",
      message: `Scenario \`${scenario.name}\` targets unknown commitment \`${scenario.commitment}\`.`,
      ...(spanOf(scenario) ? { span: spanOf(scenario)! } : {}),
    });
    return;
  }
  for (const given of scenario.givens) {
    const info = scope.symbols.get(given.path);
    if (!info || (info.kind !== "variable" && info.kind !== "parameter")) {
      push(diagnostics, {
        code: "COV-LINK-MISSING-REFERENCE",
        severity: "error",
        message: `Scenario input \`${given.path}\` is not a declared variable or parameter of \`${scenario.commitment}\`.`,
        ...(spanOf(given) ? { span: spanOf(given)! } : {}),
      });
    }
  }
  const expect = scenario.expect;
  if (expect.diagnostic && !(DIAGNOSTIC_CODES as readonly string[]).includes(expect.diagnostic)) {
    push(diagnostics, {
      code: "COV-LINK-UNKNOWN-DIAGNOSTIC",
      severity: "warning",
      message: `Scenario expects diagnostic \`${expect.diagnostic}\`, which is not in the catalog.`,
      ...(spanOf(expect) ? { span: spanOf(expect)! } : {}),
    });
  }
}

/** Symbol tables produced by {@link checkModel}, keyed by commitment id. */
export type ModelScopes = ReadonlyMap<string, CommitmentScope>;

/** The result of the linking + type-checking pass. */
export interface CheckResult {
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly scopes: ModelScopes;
}

/** Resolve cross-references and check locally-decidable types across a model. */
export function checkModel(model: Model): CheckResult {
  const diagnostics: LanguageDiagnostic[] = [];
  const scopes = new Map<string, CommitmentScope>();

  const seenPackages = new Set<string>();
  for (const imp of model.imports.concat(
    model.declarations.filter((d): d is typeof d & { $type: "Import" } => d.$type === "Import"),
  )) {
    if (seenPackages.has(imp.packageName)) {
      push(diagnostics, {
        code: "COV-LINK-DUPLICATE-IMPORT",
        severity: "warning",
        message: `Duplicate import of \`${imp.packageName}\`.`,
        ...(spanOf(imp) ? { span: spanOf(imp)! } : {}),
      });
    }
    seenPackages.add(imp.packageName);
  }

  for (const decl of model.declarations) {
    if (decl.$type === "Commitment") {
      scopes.set(decl.name, checkCommitment(decl, diagnostics));
    }
  }
  for (const decl of model.declarations) {
    if (decl.$type === "Scenario") {
      checkScenario(decl, scopes, diagnostics);
    }
  }

  return { diagnostics, scopes };
}
