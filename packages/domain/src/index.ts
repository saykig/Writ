/**
 * `@covenant/domain` public API.
 *
 * Canonical domain types, JSON Schema validation, a schema-version registry, and
 * the unified diagnostic catalog. `specs/*.schema.json` remains the interchange
 * authority; the schemas here are vendored, drift-guarded copies.
 */

// Schema kinds and vendored schema access.
export {
  SCHEMA_KINDS,
  SCHEMA_FILES,
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

// Generated types + kind-to-type map.
export type {
  CanonicalIr,
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
