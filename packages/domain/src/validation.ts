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
import {
  COMPATIBILITY_SCHEMA_KINDS,
  CORPUS_COMPATIBILITY_CONTRACT_KINDS,
  RAW_COMPATIBILITY_SCHEMAS,
  RAW_CORPUS_COMPATIBILITY_CONTRACTS,
  RAW_SCHEMAS,
  RAW_REVIEW_ARTIFACT_JUDGMENT_SCHEMA,
  REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID,
  SCHEMA_IDS,
  SCHEMA_KINDS,
  type CompatibilitySchemaKind,
  type SchemaKind,
} from "./schemas.js";
import { resolveSchemaVersion } from "./schema-registry.js";
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

/** Thrown when explicit version validation names no registered exact contract. */
export class UnsupportedSchemaVersionError extends Error {
  readonly code = "DOMAIN_SCHEMA_VERSION_UNSUPPORTED";
  readonly kind: SchemaKind;
  readonly schemaVersion: string;

  constructor(kind: SchemaKind, schemaVersion: string) {
    super(`Unsupported schema version for ${kind}: ${schemaVersion}`);
    this.name = "UnsupportedSchemaVersionError";
    this.kind = kind;
    this.schemaVersion = schemaVersion;
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
for (const kind of COMPATIBILITY_SCHEMA_KINDS) {
  const schema = RAW_COMPATIBILITY_SCHEMAS[kind];
  ajv.addSchema(schema, String(schema.$id));
}
for (const kind of CORPUS_COMPATIBILITY_CONTRACT_KINDS) {
  const schema = RAW_CORPUS_COMPATIBILITY_CONTRACTS[kind];
  ajv.addSchema(schema, String(schema.$id));
}

ajv.addSchema(RAW_REVIEW_ARTIFACT_JUDGMENT_SCHEMA, REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID);
const reviewArtifactJudgmentValidator = ajv.compile(RAW_REVIEW_ARTIFACT_JUDGMENT_SCHEMA);

const validators: Record<SchemaKind, ValidateFunction> = Object.fromEntries(
  SCHEMA_KINDS.map((kind) => [kind, ajv.compile(RAW_SCHEMAS[kind])]),
) as Record<SchemaKind, ValidateFunction>;

const compatibilityValidators: Record<CompatibilitySchemaKind, ValidateFunction> =
  Object.fromEntries(
    COMPATIBILITY_SCHEMA_KINDS.map((kind) => [kind, ajv.compile(RAW_COMPATIBILITY_SCHEMAS[kind])]),
  ) as Record<CompatibilitySchemaKind, ValidateFunction>;

function validationResult(validator: ValidateFunction, data: unknown): ValidationResult {
  const ok = validator(data);
  if (ok) return { valid: true, errors: [] };
  return { valid: false, errors: (validator.errors ?? []).map(toIssue) };
}

/**
 * Validate `data` against the schema for `kind`, returning a structured result.
 * Never throws for schema-invalid input; errors carry the failing JSON path.
 */
export function validate(kind: SchemaKind, data: unknown): ValidationResult {
  if (
    kind === "record-judgment" &&
    data !== null &&
    typeof data === "object" &&
    (data as { schema_version?: unknown }).schema_version === "0.3.0"
  ) {
    return validationResult(reviewArtifactJudgmentValidator, data);
  }
  if (
    data !== null &&
    typeof data === "object" &&
    (data as { schema_version?: unknown }).schema_version === "0.1.0" &&
    (COMPATIBILITY_SCHEMA_KINDS as readonly string[]).includes(kind)
  ) {
    return validationResult(compatibilityValidators[kind as CompatibilitySchemaKind], data);
  }
  return validationResult(validators[kind], data);
}

/** Validate against an explicitly selected native record grammar version. */
export function validateVersion(
  kind: SchemaKind,
  data: unknown,
  schemaVersion: string,
): ValidationResult {
  const contract = resolveSchemaVersion(kind, schemaVersion);
  if (!contract) throw new UnsupportedSchemaVersionError(kind, schemaVersion);
  const validator = ajv.getSchema(contract.schemaId);
  if (!validator) throw new Error(`Registered schema is unavailable: ${contract.schemaId}`);
  return validationResult(validator, data);
}

/**
 * Validate `data` against a contract named by its schema `$id`.
 *
 * A corpus manifest declares the exact contract its record files satisfy. This
 * resolves that declaration against the registered schemas, so a manifest can
 * never be checked against a contract other than the one it names. An `$id` that
 * is not registered is an error rather than a silent pass.
 */
export function validateContract(contractId: string, data: unknown): ValidationResult {
  const validator = ajv.getSchema(contractId);
  if (!validator) {
    throw new Error(`Unknown record contract: ${contractId}`);
  }
  return validationResult(validator as ValidateFunction, data);
}

/** True when `contractId` resolves to a registered contract. */
export function isKnownContract(contractId: string): boolean {
  return ajv.getSchema(contractId) !== undefined;
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
