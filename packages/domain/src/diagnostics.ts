/**
 * The unified, versioned diagnostic catalog (ADR-0011).
 *
 * There is one authoritative set of diagnostic codes. Each entry has a stable
 * `code`, a `severity`, a `category`, and a human `messageTemplate`. Codes are
 * never renumbered or repurposed once released; adding a diagnostic is an
 * additive, versioned change. Static (score-analysis) findings — a methodology
 * is defective regardless of evidence — are kept distinct from evaluation-time
 * findings over a concrete fact environment.
 */

/** Severity of a diagnostic. */
export type DiagnosticSeverity = "error" | "warning" | "info";

/** Category of a diagnostic, per ADR-0011. */
export type DiagnosticCategory =
  "syntax" | "type" | "semantic-lint" | "score-analysis" | "evaluation" | "provenance";

/** A catalog entry: the stable definition of a diagnostic code. */
export interface DiagnosticDefinition {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  /** Message template; `{name}` placeholders are filled by {@link makeDiagnostic}. */
  messageTemplate: string;
}

/**
 * The catalog version. Bumped when diagnostics are added; existing codes keep
 * their meaning across versions.
 */
export const DIAGNOSTIC_CATALOG_VERSION = "1.0.0";

const DEFINITIONS = [
  // --- Static score-analysis (analyzer; asserted by scenarios) ---
  {
    code: "COV-SCORE-GAP",
    severity: "error",
    category: "score-analysis",
    messageTemplate:
      "Score program has an uncovered input region: no rule matches and `otherwise` does not resolve it ({witness}).",
  },
  {
    code: "COV-SCORE-OVERLAP",
    severity: "error",
    category: "score-analysis",
    messageTemplate:
      "Score rules `{ruleA}` and `{ruleB}` overlap with different results and are not marked intentional ({witness}).",
  },
  {
    code: "COV-SCORE-UNREACHABLE",
    severity: "warning",
    category: "score-analysis",
    messageTemplate: "Score rule `{rule}` is unreachable: no input satisfies it given prior rules.",
  },
  {
    code: "COV-SCORE-MONOTONICITY",
    severity: "error",
    category: "score-analysis",
    messageTemplate:
      "Score program violates a declared monotonicity assertion along `{variable}` ({witness}).",
  },

  // --- Evaluation-time (deterministic evaluator over a fact environment) ---
  {
    code: "COV-EVAL-DECISIVE-UNKNOWN",
    severity: "warning",
    category: "evaluation",
    messageTemplate:
      "Result is unresolved because a decisive input is `unknown` and unknown is not treated as false at `{path}`.",
  },
  {
    code: "COV-EVAL-AMBIGUOUS",
    severity: "warning",
    category: "evaluation",
    messageTemplate:
      "Multiple score rules of equal priority match with different results at `{path}`; the outcome is ambiguous.",
  },
  {
    code: "COV-EVAL-SAME-RESULT-OVERLAP",
    severity: "info",
    category: "evaluation",
    messageTemplate:
      "Score rules `{ruleA}` and `{ruleB}` both match and agree on result `{result}` (benign overlap).",
  },

  // --- Semantic-lint placeholders (categories reserved for the analyzer) ---
  {
    code: "COV-LINT-TYPE",
    severity: "error",
    category: "type",
    messageTemplate: "Type error at `{path}`: expected `{expected}`, found `{actual}`.",
  },
  {
    code: "COV-LINT-UNIT",
    severity: "warning",
    category: "semantic-lint",
    messageTemplate:
      "Unit inconsistency at `{path}`: `{found}` is not compatible with `{expected}`.",
  },
  {
    code: "COV-LINT-TIME-AXIS",
    severity: "warning",
    category: "semantic-lint",
    messageTemplate:
      "Time-axis inconsistency at `{path}`: comparing values on different temporal axes ({detail}).",
  },
  {
    code: "COV-LINT-IDENTITY",
    severity: "warning",
    category: "semantic-lint",
    messageTemplate:
      "Action-identity concern at `{path}`: identity policy `{policy}` may merge or split distinct actions.",
  },
  {
    code: "COV-LINT-ATTRIBUTION",
    severity: "warning",
    category: "semantic-lint",
    messageTemplate: "Attribution is ambiguous at `{path}`: `{detail}`.",
  },
  {
    code: "COV-LINT-SOURCE-RATIONALE",
    severity: "warning",
    category: "provenance",
    messageTemplate:
      "Rationale `{rationaleId}` is not anchored to any source passage; source-rationale linkage is required.",
  },
  {
    code: "COV-LINT-MISSING-REFERENCE",
    severity: "error",
    category: "provenance",
    messageTemplate: "Reference `{reference}` at `{path}` does not resolve to a known object.",
  },
] as const satisfies ReadonlyArray<Omit<DiagnosticDefinition, "code"> & { code: string }>;

/** Union of every diagnostic code in the catalog. */
export type DiagnosticCode = (typeof DEFINITIONS)[number]["code"];

/** The frozen catalog, keyed by code. */
export const DIAGNOSTIC_CATALOG: Readonly<Record<DiagnosticCode, DiagnosticDefinition>> =
  Object.freeze(
    Object.fromEntries(
      DEFINITIONS.map((definition) => [definition.code, Object.freeze({ ...definition })]),
    ) as Record<DiagnosticCode, DiagnosticDefinition>,
  );

/** Every diagnostic code, in catalog order. */
export const DIAGNOSTIC_CODES: readonly DiagnosticCode[] = Object.freeze(
  DEFINITIONS.map((definition) => definition.code),
);

/** Where a diagnostic applies within an artifact. */
export interface DiagnosticLocation {
  /** RFC 6901 JSON Pointer or source path to the offending value. */
  path?: string;
  /** Id of the governed object the diagnostic is about. */
  objectId?: string;
  /** Source passages that anchor the finding, if any. */
  sourcePassageIds?: string[];
}

/**
 * A concrete diagnostic result. `witness` carries a counterexample (e.g. the
 * input assignment that exposes a score gap); `context` carries structured
 * detail for tooling.
 */
export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  location?: DiagnosticLocation;
  witness?: unknown;
  context?: Record<string, unknown>;
}

/** Look up a catalog definition. Returns `undefined` for an unknown code. */
export function getDiagnosticDefinition(code: DiagnosticCode): DiagnosticDefinition | undefined {
  return DIAGNOSTIC_CATALOG[code];
}

function interpolate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Options for constructing a {@link Diagnostic}. */
export interface MakeDiagnosticOptions {
  /** Values substituted into the message template's `{name}` placeholders. */
  values?: Record<string, unknown>;
  location?: DiagnosticLocation;
  witness?: unknown;
  context?: Record<string, unknown>;
}

/**
 * Build a {@link Diagnostic} from a catalog code, taking severity and the
 * message template from the catalog and interpolating any provided values.
 * Throws for an unknown code so miswired call sites fail loudly.
 */
export function makeDiagnostic(
  code: DiagnosticCode,
  options: MakeDiagnosticOptions = {},
): Diagnostic {
  const definition = DIAGNOSTIC_CATALOG[code];
  if (!definition) {
    throw new Error(`Unknown diagnostic code: ${code}`);
  }
  const diagnostic: Diagnostic = {
    code,
    severity: definition.severity,
    message: interpolate(definition.messageTemplate, options.values ?? {}),
  };
  if (options.location !== undefined) {
    diagnostic.location = options.location;
  }
  if (options.witness !== undefined) {
    diagnostic.witness = options.witness;
  }
  if (options.context !== undefined) {
    diagnostic.context = options.context;
  }
  return diagnostic;
}
