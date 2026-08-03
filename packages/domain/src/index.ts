/**
 * `@writ/domain` public API.
 *
 * Canonical domain types, JSON Schema validation, a schema-version registry, and
 * the unified diagnostic catalog. The repository `schemas/` tree is the interchange
 * authority; package-local schemas are vendored, drift-guarded copies.
 */

// Schema kinds and vendored schema access.
export {
  SCHEMA_KINDS,
  SCHEMA_FILES,
  SCHEMA_AUTHORITY_FILES,
  SCHEMA_IDS,
  RAW_SCHEMAS,
  VENDORED_SCHEMAS_DIR,
  isSchemaKind,
  readVendoredSchemaText,
  type SchemaKind,
  type JsonSchema,
} from "./schemas.js";

// Validation API.
export {
  validate,
  isValid,
  assertValid,
  getAjv,
  SchemaValidationError,
  type ValidationIssue,
  type ValidationResult,
} from "./validation.js";

// Ergonomic canonical-IR types (hand-authored, aligned to canonical-ir.schema.json).
export * from "./ir.js";
export * from "./records.js";

// Generated types for the non-IR schemas + kind-to-type map.
export type {
  Evidence,
  EvaluationReceipt,
  InterpretationProfile,
  SearchProtocol,
  MethodologyInventory,
  SourceRegistry,
  Discrepancy,
  Release,
  SchemaTypeMap,
  SchemaTypeFor,
} from "./types.js";

// Schema-version registry.
export {
  SCHEMA_REGISTRY,
  resolveSchemaVersion,
  currentSchemaVersion,
  type SchemaVersionEntry,
  type SchemaRegistryEntry,
} from "./schema-registry.js";

// Diagnostic catalog.
export {
  DIAGNOSTIC_CATALOG,
  DIAGNOSTIC_CODES,
  DIAGNOSTIC_CATALOG_VERSION,
  getDiagnosticDefinition,
  makeDiagnostic,
  type DiagnosticSeverity,
  type DiagnosticCategory,
  type DiagnosticCode,
  type DiagnosticDefinition,
  type Diagnostic,
  type DiagnosticLocation,
  type MakeDiagnosticOptions,
} from "./diagnostics.js";
