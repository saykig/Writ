/**
 * AST → canonical IR compiler (LANG-003).
 *
 * Lowers Covenant surface syntax to the normalized `@covenant/domain` canonical
 * IR: language sugar (`between {a,b}`, named subject sets, inclusive-interval
 * brackets) is expanded, boolean trees are flattened to n-ary form, and bare
 * identifiers are resolved to `ref`s (declared symbols and field paths) or string
 * `literal`s (enum/category values in value position). Compilation is pure and
 * deterministic and never touches the DB or `@covenant/api`.
 *
 * The IR's own `source_map` field is left empty (`{}`) — a richer node→span map
 * is returned alongside the IR so callers can offer source navigation without
 * perturbing the IR's content hash. The package `content_hash` is a placeholder
 * of zeros; content-addressing the compiled bundle is a separate publish step.
 */

import type {
  Assertion as IrAssertion,
  AssertionDomain,
  CanonicalIr,
  ClassificationBlock,
  Commitment as IrCommitment,
  CompareOp,
  DeriveRule as IrDeriveRule,
  Expr,
  Measure as IrMeasure,
  Parameter as IrParameter,
  Predicate as IrPredicate,
  ScoreProgram,
  ScoreRule as IrScoreRule,
  Source as IrSource,
  TypeDecl,
  Variable as IrVariable,
} from "@covenant/domain";
import type {
  Assertion,
  BinaryExpression,
  Classification,
  Commitment,
  Domain as AstDomain,
  Expression,
  Measure,
  Model,
  Parameter,
  Predicate,
  ScoreBlock,
  Source,
  Variable,
} from "./generated/ast.js";
import type { LanguageDiagnostic, SourceSpan } from "./diagnostics.js";
import { spanOf } from "./parse.js";
import { PRELUDE_ISSUE_AREAS, PRELUDE_SETS } from "./prelude.js";

const ZERO_HASH = `sha256:${"0".repeat(64)}`;

/** A single node→span entry in the rich (out-of-band) source map. */
export interface SourceMapEntry {
  /** Stable semantic key, e.g. `commitment:AI_SME_ADOPTION` or `score_rule:…`. */
  readonly key: string;
  readonly span: SourceSpan;
}

/** A resolved import, pinned to a content hash (empty when nothing is imported). */
export interface ResolvedImport {
  readonly name: string;
  readonly version: string;
  readonly content_hash: string;
}

/** The full result of compiling one module. */
export interface CompileResult {
  /** The canonical IR, or `undefined` when compilation could not proceed. */
  readonly ir?: CanonicalIr;
  /** Compiler diagnostics (lowering-time faults and warnings). */
  readonly diagnostics: readonly LanguageDiagnostic[];
  /** Out-of-band node→span source map (not embedded in the hashed IR). */
  readonly sourceMap: readonly SourceMapEntry[];
  /** The resolved import lock. */
  readonly importLock: readonly ResolvedImport[];
}

const COMPARE_OP: Readonly<Record<string, CompareOp>> = {
  "==": "eq",
  "!=": "neq",
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte",
  in: "in",
  overlaps: "overlaps",
  before: "before",
  after: "after",
  contains: "contains",
};

/** Lowering context: the set of names declared in the enclosing commitment. */
interface LowerContext {
  readonly symbols: ReadonlySet<string>;
  readonly diagnostics: LanguageDiagnostic[];
}

/** Where an expression sits, which decides how a bare identifier is lowered. */
type Position = "operand" | "value";

function literal(value: unknown): Expr {
  return { kind: "literal", value };
}

function ref(path: string): Expr {
  return { kind: "ref", path };
}

/** Flatten same-operator children into a single n-ary node. */
function nary(op: "and" | "or" | "set" | "add" | "multiply", parts: readonly Expr[]): Expr {
  const operands: Expr[] = [];
  for (const part of parts) {
    if (part.kind === "nary" && part.op === op) {
      operands.push(...part.operands);
    } else {
      operands.push(part);
    }
  }
  return { kind: "nary", op, operands };
}

/** The value carried by a literal AST node (already quote-stripped by Langium). */
function literalValue(node: Expression): unknown {
  switch (node.$type) {
    case "StringLiteral":
      return node.value;
    case "NumberLiteral":
      return node.value;
    case "BooleanLiteral":
      return node.value === "true";
    case "TruthLiteral":
      return node.value;
    case "DateLiteral":
      return node.value;
    case "ReferenceExpression":
      return node.path;
    default:
      return undefined;
  }
}

function _isLiteralNode(node: Expression): boolean {
  return (
    node.$type === "StringLiteral" ||
    node.$type === "NumberLiteral" ||
    node.$type === "BooleanLiteral" ||
    node.$type === "TruthLiteral" ||
    node.$type === "DateLiteral"
  );
}

/** Lower an arbitrary expression to canonical IR. */
function lowerExpr(node: Expression, ctx: LowerContext, position: Position = "operand"): Expr {
  switch (node.$type) {
    case "StringLiteral":
    case "NumberLiteral":
    case "BooleanLiteral":
    case "TruthLiteral":
    case "DateLiteral":
      return literal(literalValue(node));

    case "ReferenceExpression": {
      const path = node.path;
      // A declared symbol, or any identifier not in value position, is a
      // reference (variable, parameter, or a row/field path). A bare identifier
      // in value position that is not declared is an enum/category label.
      if (position === "value" && !ctx.symbols.has(path)) {
        return literal(path);
      }
      return ref(path);
    }

    case "SetLiteral":
      return nary(
        "set",
        node.elements.map((element) => lowerExpr(element, ctx, "value")),
      );

    case "CallExpression":
      return {
        kind: "call",
        function: node.func,
        arguments: node.args.map((arg) => lowerExpr(arg, ctx, "operand")),
      };

    case "QueryExpression": {
      if (node.extraArgs.length > 0) {
        // A comma-separated argument list is a plain function call, not a query.
        return {
          kind: "call",
          function: node.op,
          arguments: [
            ref(node.collection),
            ...node.extraArgs.map((arg) => lowerExpr(arg, ctx, "operand")),
          ],
        };
      }
      const query: Extract<Expr, { kind: "query" }> = {
        kind: "query",
        operation: node.op as Extract<Expr, { kind: "query" }>["operation"],
        collection: node.collection,
      };
      const where = node.where ? lowerExpr(node.where, ctx, "operand") : undefined;
      const select = node.select ? lowerExpr(node.select, ctx, "operand") : undefined;
      return {
        ...query,
        ...(where ? { where } : {}),
        ...(node.distinctBy ? { distinct_by: node.distinctBy } : {}),
        ...(select ? { select } : {}),
      };
    }

    case "UnaryExpression": {
      const op = node.op as "not" | "nonempty" | "is_known" | "is_contested";
      return { kind: "unary", op, operand: lowerExpr(node.operand, ctx, "operand") };
    }

    case "BinaryExpression":
      return lowerBinary(node, ctx);

    default:
      return literal(null);
  }
}

function lowerBinary(node: BinaryExpression, ctx: LowerContext): Expr {
  const op = node.op;

  if (op === "and" || op === "or") {
    return nary(op, [lowerExpr(node.left, ctx, "operand"), lowerExpr(node.right, ctx, "operand")]);
  }

  if (op === "between") {
    const left = lowerExpr(node.left, ctx, "operand");
    const bounds = node.right.$type === "SetLiteral" ? node.right.elements : [];
    if (bounds.length === 2) {
      const lo = literalValue(bounds[0]!);
      const hi = literalValue(bounds[1]!);
      return nary("and", [
        { kind: "compare", op: "gte", left, right: literal(lo) },
        { kind: "compare", op: "lte", left, right: literal(hi) },
      ]);
    }
    ctx.diagnostics.push({
      code: "COV-EXPR-BETWEEN-ARITY",
      severity: "error",
      message: "`between` requires a two-element set of bounds, e.g. `between {1, 4}`.",
      ...(spanOf(node) ? { span: spanOf(node)! } : {}),
    });
    return left;
  }

  if (op === "+" || op === "-") {
    const parts = [lowerExpr(node.left, ctx, "operand"), lowerExpr(node.right, ctx, "operand")];
    if (op === "+") return nary("add", parts);
    return { kind: "call", function: "subtract", arguments: parts };
  }

  const compareOp = COMPARE_OP[op];
  if (!compareOp) {
    ctx.diagnostics.push({
      code: "COV-EXPR-UNKNOWN-OP",
      severity: "error",
      message: `Unsupported operator \`${op}\`.`,
      ...(spanOf(node) ? { span: spanOf(node)! } : {}),
    });
    return literal(null);
  }
  return {
    kind: "compare",
    op: compareOp,
    left: lowerExpr(node.left, ctx, "operand"),
    right: lowerExpr(node.right, ctx, "value"),
  };
}

// --- Member collection helpers ---------------------------------------------

function collectSymbols(commitment: Commitment): Set<string> {
  const symbols = new Set<string>();
  for (const member of commitment.members) {
    switch (member.$type) {
      case "Variable":
      case "Parameter":
      case "Dimension":
      case "Goal":
      case "PartnerClass":
      case "Predicate":
      case "Classification":
        symbols.add(member.name);
        break;
      default:
        break;
    }
  }
  return symbols;
}

function lowerSource(source: Source): IrSource {
  let uri = "";
  let mediaType: string | undefined;
  let sha256: string | undefined;
  let retrievedAt: string | undefined;
  for (const property of source.properties) {
    switch (property.$type) {
      case "SourceUri":
        uri = property.value;
        break;
      case "SourceMediaType":
        mediaType = property.value;
        break;
      case "SourceSha":
        sha256 = property.value;
        break;
      case "SourceRetrieved":
        retrievedAt = property.value;
        break;
      default:
        break;
    }
  }
  return {
    id: source.name,
    uri,
    ...(mediaType !== undefined ? { media_type: mediaType } : {}),
    ...(sha256 !== undefined ? { sha256 } : {}),
    ...(retrievedAt !== undefined ? { retrieved_at: retrievedAt } : {}),
  };
}

function resolveSubjects(commitment: Commitment, ctx: LowerContext): string[] {
  const member = commitment.members.find((m) => m.$type === "Subjects");
  if (!member || member.$type !== "Subjects") {
    return [];
  }
  const value = member.value;
  if (value.$type === "ReferenceExpression") {
    const set = PRELUDE_SETS[value.path];
    if (set) return [...set];
    ctx.diagnostics.push({
      code: "COV-LINK-UNKNOWN-SET",
      severity: "error",
      message: `Unknown subject set \`${value.path}\`. Declare it or import a standard set.`,
      ...(spanOf(value) ? { span: spanOf(value)! } : {}),
    });
    return [];
  }
  if (value.$type === "SetLiteral") {
    return value.elements.map((element) =>
      element.$type === "ReferenceExpression" ? element.path : String(literalValue(element)),
    );
  }
  ctx.diagnostics.push({
    code: "COV-LINK-SUBJECTS",
    severity: "error",
    message: "`subjects` must be a named set or a set literal of institutions.",
    ...(spanOf(value) ? { span: spanOf(value)! } : {}),
  });
  return [];
}

function lowerParameter(parameter: Parameter, _ctx: LowerContext): IrParameter {
  const allowed =
    parameter.allowed && parameter.allowed.$type === "SetLiteral"
      ? parameter.allowed.elements.map((element) => literalValue(element))
      : undefined;
  return {
    id: parameter.name,
    type: parameter.type,
    default: literalValue(parameter.default),
    ...(allowed ? { allowed } : {}),
  };
}

function lowerPredicate(predicate: Predicate, ctx: LowerContext): IrPredicate {
  const rules: IrDeriveRule[] = predicate.rules.map((rule, index) => {
    const derive: IrDeriveRule = {
      id: `${predicate.name}_derive_${index}`,
      conclusion: rule.conclusion as IrDeriveRule["conclusion"],
      when: lowerExpr(rule.when, ctx, "operand"),
      ...(rule.priority !== undefined ? { priority: rule.priority } : {}),
      ...(rule.rationale ? { rationale_id: rule.rationale } : {}),
    };
    return derive;
  });
  return {
    id: predicate.name,
    parameters: predicate.params.map((p) => ({ name: p.name, type: p.type })),
    rules,
  };
}

function lowerClassification(
  classification: Classification,
  ctx: LowerContext,
): ClassificationBlock {
  return {
    id: classification.name,
    mode: classification.mode,
    rules: classification.rules.map((rule, index) => ({
      id: rule.label ? `${classification.name}_${rule.label}` : `${classification.name}_${index}`,
      label: rule.label,
      priority: rule.priority,
      when: lowerExpr(rule.when, ctx, "operand"),
      ...(rule.rationale ? { rationale_id: rule.rationale } : {}),
    })),
    ...(classification.otherwise
      ? {
          otherwise_label: classification.otherwise.label,
          ...(classification.otherwise.safe ? { otherwise_safe_under_open_world: true } : {}),
        }
      : {}),
  };
}

function lowerVariable(variable: Variable, ctx: LowerContext): IrVariable {
  return {
    id: variable.name,
    type: variable.type,
    expression: lowerExpr(variable.expression, ctx, "operand"),
  };
}

function lowerMeasure(measure: Measure, ctx: LowerContext): IrMeasure {
  return {
    id: measure.name,
    components: measure.components.map((component) => ({
      id: component.name,
      weight: component.weight,
      anchors: component.anchors.map((anchor) => ({
        value: anchor.value,
        when: lowerExpr(anchor.when, ctx, "operand"),
        ...(anchor.rationale ? { rationale_id: anchor.rationale } : {}),
      })),
      ...(component.source ? { source_passage_ids: [component.source] } : {}),
    })),
    aggregation: { strategy: measure.strategy as "weighted_ordinal_percent", scale: measure.scale },
  };
}

function lowerScore(block: ScoreBlock, ctx: LowerContext): ScoreProgram {
  const rules: IrScoreRule[] = block.rules.map((rule, index) => {
    const id = rule.name ?? `rule_${index}`;
    const result = rule.result as IrScoreRule["result"];
    return {
      id,
      priority: rule.priority,
      result,
      when: lowerExpr(rule.when, ctx, "operand"),
      ...(rule.intentionalOverlap ? { intentional_overlap: true } : {}),
      ...(rule.rationale ? { rationale_id: rule.rationale } : {}),
    };
  });
  const otherwiseResult = (block.otherwise.resultKw ??
    block.otherwise.resultValue ??
    "unresolved") as ScoreProgram["otherwise"]["result"];
  return {
    rules,
    otherwise: { result: otherwiseResult, message: block.otherwise.message },
  };
}

function lowerDomain(domain: AstDomain, _ctx: LowerContext): AssertionDomain {
  if (domain.range) {
    return {
      variable: domain.variable,
      values: { min: domain.range.min ?? 0, max: domain.range.max ?? 0 },
    };
  }
  const values =
    domain.set && domain.set.$type === "SetLiteral"
      ? domain.set.elements.map((element) => literalValue(element))
      : [];
  return { variable: domain.variable, values };
}

function lowerAssertion(
  assertion: Assertion,
  ctx: LowerContext,
  usedIds: Set<string>,
): IrAssertion {
  let id = `score_${assertion.kind}`;
  if (usedIds.has(id)) {
    let suffix = 2;
    while (usedIds.has(`${id}_${suffix}`)) suffix += 1;
    id = `${id}_${suffix}`;
  }
  usedIds.add(id);
  const domains = assertion.domains.map((domain) => lowerDomain(domain, ctx));
  return {
    id,
    kind: assertion.kind as IrAssertion["kind"],
    ...(domains.length > 0 ? { domains } : {}),
    ...(assertion.exceptions
      ? { exceptions: lowerExpr(assertion.exceptions, ctx, "operand") }
      : {}),
  };
}

function lowerCommitment(
  commitment: Commitment,
  ctx: LowerContext,
  sourceMap: SourceMapEntry[],
): IrCommitment {
  const symbols = collectSymbols(commitment);
  const localCtx: LowerContext = { symbols, diagnostics: ctx.diagnostics };

  const title = commitment.members.find((m) => m.$type === "Title");
  const summit = commitment.members.find((m) => m.$type === "Summit");
  const adopted = commitment.members.find((m) => m.$type === "Adopted");
  const window = commitment.members.find((m) => m.$type === "Window");
  const evidence = commitment.members.find((m) => m.$type === "EvidencePolicy");
  const unknown = commitment.members.find((m) => m.$type === "UnknownPolicy");
  const issueAreasMember = commitment.members.find((m) => m.$type === "IssueAreas");
  const identity = commitment.members.find((m) => m.$type === "ActionIdentity");

  const dimensions = commitment.members
    .filter((m) => m.$type === "Dimension")
    .map((m) => (m.$type === "Dimension" ? namedElement(m.name, m.description) : undefined))
    .filter((x): x is { id: string; name: string } => x !== undefined);
  const goals = commitment.members
    .filter((m) => m.$type === "Goal")
    .map((m) => (m.$type === "Goal" ? namedElement(m.name, m.description) : undefined))
    .filter((x): x is { id: string; name: string } => x !== undefined);
  const partnerClasses = commitment.members
    .filter((m) => m.$type === "PartnerClass")
    .map((m) => (m.$type === "PartnerClass" ? namedElement(m.name, m.description) : undefined))
    .filter((x): x is { id: string; name: string } => x !== undefined);

  const parameters = commitment.members
    .filter((m) => m.$type === "Parameter")
    .map((m) => lowerParameter(m as Parameter, localCtx));
  const predicates = commitment.members
    .filter((m) => m.$type === "Predicate")
    .map((m) => lowerPredicate(m as Predicate, localCtx));
  const classifications = commitment.members
    .filter((m) => m.$type === "Classification")
    .map((m) => lowerClassification(m as Classification, localCtx));
  const variables = commitment.members
    .filter((m) => m.$type === "Variable")
    .map((m) => {
      const variable = lowerVariable(m as Variable, localCtx);
      const span = spanOf(m);
      if (span) sourceMap.push({ key: `variable:${commitment.name}.${variable.id}`, span });
      return variable;
    });

  const measures = commitment.members
    .filter((m) => m.$type === "Measure")
    .map((m) => {
      const measure = lowerMeasure(m as Measure, localCtx);
      const span = spanOf(m);
      if (span) sourceMap.push({ key: `measure:${commitment.name}.${measure.id}`, span });
      return measure;
    });

  const scoreBlock = commitment.members.find((m) => m.$type === "ScoreBlock");
  const scoreProgram: ScoreProgram = scoreBlock
    ? lowerScore(scoreBlock as ScoreBlock, localCtx)
    : { rules: [], otherwise: { result: "unresolved", message: "No score block declared." } };
  if (scoreBlock && scoreBlock.$type === "ScoreBlock") {
    for (const rule of (scoreBlock as ScoreBlock).rules) {
      const span = spanOf(rule);
      if (span && rule.name) {
        sourceMap.push({ key: `score_rule:${commitment.name}.${rule.name}`, span });
      }
    }
  }
  if (!scoreBlock) {
    ctx.diagnostics.push({
      code: "COV-SCORE-MISSING",
      severity: "error",
      message: `Commitment \`${commitment.name}\` declares no score block.`,
      ...(spanOf(commitment) ? { span: spanOf(commitment)! } : {}),
      objectId: commitment.name,
    });
  }

  const usedAssertionIds = new Set<string>();
  const assertions = commitment.members
    .filter((m) => m.$type === "Assertion")
    .map((m) => lowerAssertion(m as Assertion, localCtx, usedAssertionIds));

  const subjects = resolveSubjects(commitment, localCtx);

  // Action identity: default to review-required over `id` when unstated, and
  // warn (the spec treats counting without an identity policy as a concern).
  let actionIdentity: IrCommitment["action_identity"];
  if (identity && identity.$type === "ActionIdentity") {
    actionIdentity = {
      policy: identity.policy as IrCommitment["action_identity"]["policy"],
      key_paths: [...identity.keyPaths],
    };
  } else {
    actionIdentity = { policy: "review_required", key_paths: ["id"] };
    ctx.diagnostics.push({
      code: "COV-IDENTITY-MISSING",
      severity: "warning",
      message: `Commitment \`${commitment.name}\` declares no action_identity; defaulting to review_required by id.`,
      ...(spanOf(commitment) ? { span: spanOf(commitment)! } : {}),
      objectId: commitment.name,
    });
  }

  const issueAreas =
    issueAreasMember && issueAreasMember.$type === "IssueAreas"
      ? [...issueAreasMember.areas]
      : PRELUDE_ISSUE_AREAS[commitment.name]
        ? [...PRELUDE_ISSUE_AREAS[commitment.name]!]
        : undefined;

  const span = spanOf(commitment);
  if (span) sourceMap.push({ key: `commitment:${commitment.name}`, span });

  const ir: IrCommitment = {
    id: commitment.name,
    title: title && title.$type === "Title" ? title.value : "",
    ...(summit && summit.$type === "Summit" ? { summit_id: summit.value } : {}),
    ...(adopted && adopted.$type === "Adopted" ? { adopted_at: adopted.value } : {}),
    subjects,
    evaluation_window:
      window && window.$type === "Window"
        ? {
            start: window.start,
            end: window.end,
            start_inclusive: window.startBracket === "[",
            end_inclusive: window.endBracket === "]",
          }
        : { start: "", end: "", start_inclusive: true, end_inclusive: true },
    ...(issueAreas ? { issue_areas: issueAreas } : {}),
    evidence_policy:
      evidence && evidence.$type === "EvidencePolicy" ? evidence.value : "open_world",
    unknown_policy: unknown && unknown.$type === "UnknownPolicy" ? unknown.value : "propagate",
    ...(dimensions.length > 0 ? { dimensions } : {}),
    ...(goals.length > 0 ? { goals } : {}),
    ...(partnerClasses.length > 0 ? { partner_classes: partnerClasses } : {}),
    parameters,
    action_identity: actionIdentity,
    predicates,
    classifications,
    variables,
    ...(measures.length > 0 ? { measures } : {}),
    score_program: scoreProgram,
    assertions,
    rationales: [],
  };
  return ir;
}

function namedElement(name: string, description?: string): { id: string; name: string } {
  return { id: name, name: description ?? name };
}

/** Options for {@link compileModel}. */
export interface CompileOptions {
  /** Language version stamped into the IR (defaults to the model's own). */
  readonly languageVersion?: string;
}

/**
 * Compile a parsed {@link Model} into canonical IR plus an out-of-band source
 * map and resolved import lock. Emits diagnostics for anything that cannot be
 * lowered but always returns a best-effort IR when a package header is present.
 */
export function compileModel(model: Model, options: CompileOptions = {}): CompileResult {
  const diagnostics: LanguageDiagnostic[] = [];
  const sourceMap: SourceMapEntry[] = [];
  const ctx: LowerContext = { symbols: new Set(), diagnostics };

  const importLock: ResolvedImport[] = model.imports
    .concat(
      model.declarations.filter((d): d is typeof d & { $type: "Import" } => d.$type === "Import"),
    )
    .map((imp) => ({
      name: imp.packageName,
      version: imp.version,
      content_hash: imp.contentHash ?? ZERO_HASH,
    }));

  const sources: IrSource[] = model.declarations
    .filter((d) => d.$type === "Source")
    .map((d) => lowerSource(d as Source));

  const types: TypeDecl[] = model.declarations
    .filter((d) => d.$type === "EnumDeclaration")
    .map((d) =>
      d.$type === "EnumDeclaration"
        ? { id: d.name, kind: "enum" as const, values: [...d.values] }
        : { id: "", kind: "enum" as const },
    );
  for (const decl of model.declarations) {
    if (decl.$type === "ConceptDeclaration") {
      types.push({
        id: decl.name,
        kind: "concept",
        ...(decl.base ? { base: decl.base } : {}),
      });
    }
  }

  const commitments: IrCommitment[] = model.declarations
    .filter((d) => d.$type === "Commitment")
    .map((d) => lowerCommitment(d as Commitment, ctx, sourceMap));

  if (commitments.length === 0) {
    diagnostics.push({
      code: "COV-COMPILE-NO-COMMITMENT",
      severity: "error",
      message: "A methodology must declare at least one commitment.",
    });
  }

  const ir: CanonicalIr = {
    schema_version: "1.0.0",
    language_version: options.languageVersion ?? model.languageVersion ?? "0.1",
    package: {
      name: model.packageName,
      version: model.packageVersion,
      content_hash: ZERO_HASH,
      imports: importLock,
    },
    sources,
    types,
    commitments,
    source_map: {},
    diagnostic_waivers: [],
  };

  return { ir, diagnostics, sourceMap, importLock };
}
