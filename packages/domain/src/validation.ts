/**
 * JSON Schema validation for governed Writ artifacts.
 *
 * Every vendored `*.schema.json` contract is registered on a single AJV 2020
 * instance so any cross-`$ref` between them resolves. Validation is
 * deterministic: no network, randomness, or wall-clock access.
 */
import _Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";

// ajv and ajv-formats are CJS. Under NodeNext their default import is typed as a
// module namespace ({ default: Ctor }); under a bundler resolution (e.g. Next)
// it is the constructor/function directly. This conditional unwraps to the real
// callable under BOTH resolutions, and the runtime `.default ?? self` picks it.
type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const addFormats = ((_addFormats as { default?: unknown }).default ?? _addFormats) as DefaultExport<
  typeof _addFormats
>;
import { RAW_SCHEMAS, SCHEMA_IDS, SCHEMA_KINDS, type SchemaKind } from "./schemas.js";
import type { SchemaTypeMap } from "./types.js";

/** A single validation failure, with the JSON path to the offending value. */
export interface ValidationIssue {
  /** RFC 6901 JSON Pointer into the validated instance (e.g. `/claims/0/truth_value`). */
  instancePath: string;
  /** JSON Pointer into the schema that produced the failure. */
  schemaPath: string;
  /** The failing keyword (e.g. `enum`, `required`, `additionalProperties`). */
  keyword: string;
  /** Human-readable message from AJV. */
  message: string;
  /** Keyword-specific parameters (e.g. the missing property name). */
  params: Record<string, unknown>;
}

/** The result of a non-throwing validation. */
export type ValidationResult =
  { valid: true; errors: [] } | { valid: false; errors: ValidationIssue[] };

/** Thrown by {@link assertValid} when an instance fails validation. */
export class SchemaValidationError extends Error {
  readonly kind: SchemaKind;
  readonly issues: ValidationIssue[];

  constructor(kind: SchemaKind, issues: ValidationIssue[]) {
    const detail = issues
      .map((issue) => `  ${issue.instancePath || "/"}: ${issue.message ?? issue.keyword}`)
      .join("\n");
    super(`Invalid ${kind} document (${issues.length} error(s)):\n${detail}`);
    this.name = "SchemaValidationError";
    this.kind = kind;
    this.issues = issues;
  }
}

function toIssue(error: ErrorObject): ValidationIssue {
  return {
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? "",
    params: (error.params ?? {}) as Record<string, unknown>,
  };
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  // Formats are asserted (see below); this keeps behavior explicit.
  validateFormats: true,
});
addFormats(ajv);

// Register every schema under its `$id` so cross-references resolve, then keep a
// compiled validator per kind for fast, deterministic reuse.
for (const kind of SCHEMA_KINDS) {
  ajv.addSchema(RAW_SCHEMAS[kind], SCHEMA_IDS[kind] || kind);
}

const validators: Record<SchemaKind, ValidateFunction> = Object.fromEntries(
  SCHEMA_KINDS.map((kind) => [kind, ajv.compile(RAW_SCHEMAS[kind])]),
) as Record<SchemaKind, ValidateFunction>;

/**
 * Validate `data` against the schema for `kind`, returning a structured result.
 * Never throws for schema-invalid input; errors carry the failing JSON path.
 */
export function validate(kind: SchemaKind, data: unknown): ValidationResult {
  const validator = validators[kind];
  const ok = validator(data);
  if (ok) {
    return { valid: true, errors: [] };
  }
  const errors = (validator.errors ?? []).map(toIssue);
  return { valid: false, errors };
}

/**
 * Type guard: returns true (and narrows `data`) when it satisfies `kind`.
 */
export function isValid<K extends SchemaKind>(kind: K, data: unknown): data is SchemaTypeMap[K] {
  return validate(kind, data).valid;
}

/**
 * Assert that `data` satisfies the schema for `kind`, narrowing its type.
 * Throws {@link SchemaValidationError} (with JSON paths) on failure.
 */
export function assertValid<K extends SchemaKind>(
  kind: K,
  data: unknown,
): asserts data is SchemaTypeMap[K] {
  const result = validate(kind, data);
  if (!result.valid) {
    throw new SchemaValidationError(kind, result.errors);
  }
}

/** The shared AJV instance (exposed for advanced/diagnostic use). */
export function getAjv(): InstanceType<typeof Ajv2020> {
  return ajv;
}
