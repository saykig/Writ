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
  COMPATIBILITY_SCHEMA_KINDS,
  COMPATIBILITY_SCHEMA_FILES,
  RAW_COMPATIBILITY_SCHEMAS,
  CORPUS_COMPATIBILITY_CONTRACT_KINDS,
  CORPUS_COMPATIBILITY_CONTRACT_FILES,
  RAW_CORPUS_COMPATIBILITY_CONTRACTS,
  VENDORED_SCHEMAS_DIR,
  isSchemaKind,
  readVendoredSchemaText,
  type SchemaKind,
  type CompatibilitySchemaKind,
  type CorpusCompatibilityContractKind,
  type JsonSchema,
} from "./schemas.js";

// Validation API.
export {
  validate,
  validateVersion,
  validateContract,
  isKnownContract,
  isValid,
  assertValid,
  getAjv,
  SchemaValidationError,
  type ValidationIssue,
  type ValidationResult,
} from "./validation.js";

// Judgment supersession rules.
export {
  validateJudgmentSupersession,
  JUDGMENT_STATUSES,
  REVIEW_STATES,
  type JudgmentStatus,
  type ReviewState,
  type SupersessionCandidate,
  type SupersessionIssue,
  type SupersessionIssueCode,
  type SupersessionResult,
} from "./judgments.js";

// Ergonomic canonical-IR types (hand-authored, aligned to canonical-ir.schema.json).
export * from "./ir.js";
export * from "./records.js";
export * from "./institution-resolution.js";

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
