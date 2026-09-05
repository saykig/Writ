/**
 * `@writ/domain` public API.
 *
 * Native domain types, JSON Schema validation, and a schema-version registry.
 * The repository `schemas/` tree is the interchange
 * authority; package-local schemas are vendored, drift-guarded copies.
 */

// Schema kinds and vendored schema access.
export {
  SCHEMA_KINDS,
  SCHEMA_FILES,
  SCHEMA_AUTHORITY_FILES,
  SCHEMA_IDS,
  RAW_SCHEMAS,
  RAW_REVIEW_ARTIFACT_JUDGMENT_SCHEMA,
  REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID,
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
  UnsupportedSchemaVersionError,
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

export * from "./records.js";
export * from "./institution-resolution.js";

// Generated types plus kind-to-type map.
export type { Evidence, SourceRegistry, SchemaTypeMap, SchemaTypeFor } from "./types.js";

// Schema-version registry.
export {
  SCHEMA_REGISTRY,
  resolveSchemaVersion,
  currentSchemaVersion,
  type SchemaVersionEntry,
  type SchemaRegistryEntry,
} from "./schema-registry.js";
