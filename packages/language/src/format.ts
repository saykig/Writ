/**
 * Idempotent Writ formatter.
 *
 * The formatter is a canonical pretty-printer: it derives its output purely from
 * the parsed AST, so `format(format(x)) === format(x)`. Parentheses in the source
 * do not create AST nodes, so re-emitting minimal precedence-based parentheses is
 * stable across round-trips. Strings are re-quoted with JSON escaping (a superset
 * the `STRING` terminal accepts). If the input does not parse, the original text
 * is returned unchanged so a broken file is never silently rewritten.
 */

import type {
  Assertion,
  CitationAnchor,
  Commitment,
  CommitmentMember,
  ConceptDeclaration,
  Declaration,
  Domain,
  EnumDeclaration,
  Expression,
  Import,
  Model,
  Predicate,
  Profile,
  RationaleDeclaration,
  Scenario,
  ScoreBlock,
  SetDeclaration,
  Source,
} from "./generated/ast.js";
import { parseDocument } from "./parse.js";

const INDENT = "  ";

function quote(value: string): string {
  return JSON.stringify(value);
}

function num(value: number): string {
  return String(value);
}

// --- Expressions ------------------------------------------------------------

function exprPrecedence(node: Expression): number {
  switch (node.$type) {
    case "BinaryExpression":
      if (node.op === "or") return 1;
      if (node.op === "and") return 2;
      if (node.op === "+" || node.op === "-") return 5;
      return 4; // comparison / membership
    case "UnaryExpression":
      return node.op === "not" ? 3 : 6; // prefix `not` vs postfix operators
    default:
      return 7; // primary
  }
}

function printExprRaw(node: Expression): string {
  switch (node.$type) {
    case "StringLiteral":
      return quote(node.value);
    case "NumberLiteral":
      return num(node.value);
    case "BooleanLiteral":
      return node.value;
    case "TruthLiteral":
      return node.value;
    case "DateLiteral":
      return node.value;
    case "ReferenceExpression":
      return node.path;
    case "SetLiteral":
      return `{${node.elements.map((element) => printExprRaw(element)).join(", ")}}`;
    case "CallExpression":
      return `${node.func}(${node.args.map((arg) => printExprRaw(arg)).join(", ")})`;
    case "QueryExpression": {
      const parts: string[] = [node.collection];
      if (node.where) parts.push(`where ${printExprRaw(node.where)}`);
      if (node.distinctBy) parts.push(`distinct_by ${node.distinctBy}`);
      if (node.select) parts.push(`select ${printExprRaw(node.select)}`);
      let inner = parts.join(" ");
      if (node.extraArgs.length > 0) {
        inner += `, ${node.extraArgs.map((arg) => printExprRaw(arg)).join(", ")}`;
      }
      return `${node.op}(${inner})`;
    }
    case "UnaryExpression":
      return node.op === "not"
        ? `not ${printChild(node.operand, 3, false)}`
        : `${printChild(node.operand, 6, false)} ${node.op}`;
    case "BinaryExpression": {
      const p = exprPrecedence(node);
      return `${printChild(node.left, p, false)} ${node.op} ${printChild(node.right, p, true)}`;
    }
    default:
      return "";
  }
}

function printChild(node: Expression, parentPrecedence: number, isRight: boolean): string {
  const p = exprPrecedence(node);
  const inner = printExprRaw(node);
  const needParens = p < parentPrecedence || (p === parentPrecedence && isRight);
  return needParens ? `(${inner})` : inner;
}

/** Format a top-level expression (no surrounding parentheses). */
export function printExpr(node: Expression): string {
  return printExprRaw(node);
}

// --- Declarations -----------------------------------------------------------

function printAnchor(anchor: CitationAnchor): string {
  switch (anchor.$type) {
    case "PageAnchor":
      return `page ${num(anchor.page)}`;
    case "PagesAnchor":
      return `pages ${num(anchor.from)}..${num(anchor.to)}`;
    case "LinesAnchor":
      return `lines ${num(anchor.from)}..${num(anchor.to)}`;
    case "QuoteAnchor":
      return `quote ${quote(anchor.quote)}`;
    case "DomAnchor":
      return `dom ${quote(anchor.selector)}`;
    case "JsonPointerAnchor":
      return `json_pointer ${quote(anchor.pointer)}`;
    default:
      return "";
  }
}

function printImport(imp: Import): string {
  const hash = imp.contentHash ? ` hash ${quote(imp.contentHash)}` : "";
  return `import ${imp.packageName} version ${quote(imp.version)}${hash};`;
}

function printSource(source: Source): string {
  const lines: string[] = [`source ${source.name} {`];
  for (const property of source.properties) {
    switch (property.$type) {
      case "SourceUri":
        lines.push(`${INDENT}uri ${quote(property.value)};`);
        break;
      case "SourceMediaType":
        lines.push(`${INDENT}media_type ${quote(property.value)};`);
        break;
      case "SourceRetrieved":
        lines.push(`${INDENT}retrieved ${property.value};`);
        break;
      case "SourceSha":
        lines.push(`${INDENT}sha256 ${quote(property.value)};`);
        break;
      default:
        break;
    }
  }
  lines.push("}");
  return lines.join("\n");
}

function printEnum(decl: EnumDeclaration): string {
  return `enum ${decl.name} {\n${decl.values.map((v) => `${INDENT}${v}`).join(",\n")}\n}`;
}

function printConcept(decl: ConceptDeclaration): string {
  const head = decl.base ? `concept ${decl.name}: ${decl.base} {` : `concept ${decl.name} {`;
  const props = decl.properties.map((p) => `${INDENT}${p.name} ${formatConceptValue(p.value)};`);
  return `${head}\n${props.join("\n")}\n}`;
}

function formatConceptValue(value: string | number): string {
  return typeof value === "number" ? num(value) : /^[0-9]/.test(value) ? value : String(value);
}

function printSetDecl(decl: SetDeclaration): string {
  return `set ${decl.name}: ${decl.type} = ${printExprRaw(decl.value)};`;
}

function printRationale(decl: RationaleDeclaration): string {
  return `rationale ${decl.name} {\n${INDENT}text ${quote(decl.text)};\n}`;
}

function printDomain(domain: Domain): string {
  if (domain.range) {
    return `${domain.variable} in ${num(domain.range.min ?? 0)}..${num(domain.range.max ?? 0)}`;
  }
  return `${domain.variable} in ${domain.set ? printExprRaw(domain.set) : "{}"}`;
}

function printAssertion(assertion: Assertion): string {
  let text = `assert ${assertion.kind}`;
  if (assertion.domains.length > 0) {
    text += ` over ${assertion.domains.map(printDomain).join(", ")}`;
  }
  if (assertion.exceptions) {
    text += ` except ${printExprRaw(assertion.exceptions)}`;
  }
  return `${text};`;
}

function printScore(block: ScoreBlock, indent: string): string {
  const inner = indent + INDENT;
  const lines: string[] = [`${indent}score {`];
  for (const rule of block.rules) {
    let line = `${inner}result ${quote(rule.result)} priority ${num(rule.priority)} when ${printExprRaw(rule.when)}`;
    if (rule.name) line += ` id ${rule.name}`;
    if (rule.intentionalOverlap) line += ` intentional_overlap`;
    if (rule.rationale) line += ` because ${rule.rationale}`;
    lines.push(`${line};`);
  }
  const otherwiseResult = block.otherwise.resultKw ?? quote(block.otherwise.resultValue ?? "");
  lines.push(`${inner}otherwise ${otherwiseResult} ${quote(block.otherwise.message)};`);
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function printPredicate(predicate: Predicate, indent: string): string {
  const inner = indent + INDENT;
  const params = predicate.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const lines: string[] = [
    `${indent}predicate ${predicate.name}(${params}) -> ${predicate.returnType} {`,
  ];
  for (const rule of predicate.rules) {
    let line = `${inner}derive ${rule.conclusion}`;
    if (rule.priority !== undefined) line += ` priority ${num(rule.priority)}`;
    line += ` when ${printExprRaw(rule.when)}`;
    if (rule.rationale) line += ` because ${rule.rationale}`;
    lines.push(`${line};`);
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function printMember(member: CommitmentMember, indent: string): string {
  switch (member.$type) {
    case "Title":
      return `${indent}title ${quote(member.value)};`;
    case "Summit":
      return `${indent}summit ${member.value};`;
    case "Authority":
      return `${indent}authority cite ${member.source} ${printAnchor(member.anchor)};`;
    case "Adopted":
      return `${indent}adopted ${member.value};`;
    case "Subjects":
      return `${indent}subjects ${printExprRaw(member.value)};`;
    case "Window":
      return `${indent}evaluation_window ${member.startBracket}${member.start}, ${member.end}${member.endBracket};`;
    case "IssueAreas":
      return `${indent}issue_areas { ${member.areas.join(", ")} };`;
    case "EvidencePolicy":
      return `${indent}evidence_policy ${member.value};`;
    case "UnknownPolicy":
      return `${indent}unknown_policy ${member.value};`;
    case "CommitmentText":
      return `${indent}text ${quote(member.value)};`;
    case "Dimension":
      return `${indent}dimension ${member.name}${member.description ? ` ${quote(member.description)}` : ""};`;
    case "Goal":
      return `${indent}goal ${member.name}${member.description ? ` ${quote(member.description)}` : ""};`;
    case "PartnerClass":
      return `${indent}partner_class ${member.name}${member.description ? ` ${quote(member.description)}` : ""};`;
    case "Parameter": {
      const allowed =
        member.allowed && member.allowed.$type === "SetLiteral"
          ? ` allowed ${printExprRaw(member.allowed)}`
          : "";
      return `${indent}parameter ${member.name}: ${member.type} = ${printExprRaw(member.default)}${allowed};`;
    }
    case "ActionIdentity":
      return `${indent}action_identity ${member.policy} by ${member.keyPaths.join(", ")};`;
    case "Variable":
      return `${indent}let ${member.name}: ${member.type} = ${printExprRaw(member.expression)};`;
    case "Assertion":
      return `${indent}${printAssertion(member)}`;
    case "ScoreBlock":
      return printScore(member, indent);
    case "Predicate":
      return printPredicate(member, indent);
    case "Classification":
      return printClassification(member, indent);
    case "Measure":
      return printMeasure(member, indent);
    default:
      return "";
  }
}

function printMeasure(
  member: Extract<CommitmentMember, { $type: "Measure" }>,
  indent: string,
): string {
  const inner = indent + INDENT;
  const anchorIndent = inner + INDENT;
  const lines: string[] = [`${indent}measure ${member.name} {`];
  for (const component of member.components) {
    const cite = component.source ? ` cite ${component.source}` : "";
    lines.push(`${inner}component ${component.name} weight ${num(component.weight)}${cite} {`);
    for (const anchor of component.anchors) {
      let line = `${anchorIndent}anchor ${num(anchor.value)} when ${printExprRaw(anchor.when)}`;
      if (anchor.rationale) line += ` because ${anchor.rationale}`;
      lines.push(`${line};`);
    }
    lines.push(`${inner}}`);
  }
  lines.push(`${inner}aggregate ${member.strategy} scale ${num(member.scale)};`);
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function printClassification(
  member: Extract<CommitmentMember, { $type: "Classification" }>,
  indent: string,
): string {
  const inner = indent + INDENT;
  const lines: string[] = [`${indent}classify ${member.name} ${member.mode} {`];
  for (const rule of member.rules) {
    let line = `${inner}label ${rule.label} priority ${num(rule.priority)} when ${printExprRaw(rule.when)}`;
    if (rule.rationale) line += ` because ${rule.rationale}`;
    lines.push(`${line};`);
  }
  if (member.otherwise) {
    const safe = member.otherwise.safe ? ` safe_under_open_world` : "";
    lines.push(`${inner}otherwise ${member.otherwise.label}${safe};`);
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function printCommitment(commitment: Commitment): string {
  const lines: string[] = [`commitment ${commitment.name} {`];
  for (const member of commitment.members) {
    lines.push(printMember(member, INDENT));
  }
  lines.push("}");
  return lines.join("\n");
}

function printScenario(scenario: Scenario): string {
  const lines: string[] = [`scenario ${scenario.name} for ${scenario.commitment} {`];
  for (const given of scenario.givens) {
    lines.push(`${INDENT}given ${given.path} = ${printExprRaw(given.value)};`);
  }
  const expect = scenario.expect;
  if (expect.result) {
    lines.push(`${INDENT}expect result ${quote(expect.result)};`);
  } else if (expect.diagnostic) {
    lines.push(`${INDENT}expect diagnostic ${expect.diagnostic};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function printProfile(profile: Profile): string {
  const lines: string[] = [`profile ${profile.name} for ${profile.commitment} {`];
  for (const member of profile.members) {
    if (member.$type === "ProfileSet") {
      lines.push(`${INDENT}set ${member.path} = ${printExprRaw(member.value)};`);
    } else {
      lines.push(`${INDENT}waive ${member.diagnostic} because ${quote(member.reason)};`);
    }
  }
  lines.push("}");
  return lines.join("\n");
}

function printDeclaration(decl: Declaration): string {
  switch (decl.$type) {
    case "Import":
      return printImport(decl);
    case "Source":
      return printSource(decl);
    case "EnumDeclaration":
      return printEnum(decl);
    case "ConceptDeclaration":
      return printConcept(decl);
    case "SetDeclaration":
      return printSetDecl(decl);
    case "RationaleDeclaration":
      return printRationale(decl);
    case "Commitment":
      return printCommitment(decl);
    case "Scenario":
      return printScenario(decl);
    case "Profile":
      return printProfile(decl);
    default:
      return "";
  }
}

/** Pretty-print a parsed model to canonical Writ source. */
export function printModel(model: Model): string {
  const blocks: string[] = [];
  blocks.push(
    `language writ ${quote(model.languageVersion)}\npackage ${model.packageName} version ${quote(model.packageVersion)};`,
  );
  for (const imp of model.imports) {
    blocks.push(printImport(imp));
  }
  for (const decl of model.declarations) {
    blocks.push(printDeclaration(decl));
  }
  return `${blocks.join("\n\n")}\n`;
}

/**
 * Format Writ source text. Returns the canonical rendering, or the original
 * text unchanged when it does not parse (so a broken file is never rewritten).
 */
export function formatText(
  text: string,
  options: { readonly literate?: boolean; readonly fileName?: string } = {},
): string {
  const parsed = parseDocument(text, options);
  if (!parsed.ok) {
    return text;
  }
  return printModel(parsed.model);
}
