/**
 * Loads the vendored JSON Schemas (byte-for-byte copies of the `specs/` files,
 * which remain the interchange authority). Schemas are read from
 * `packages/domain/schemas/` relative to this module so resolution works the
 * same for consumers and for the test runner.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** The canonical set of schema kinds, ordered. */
export const SCHEMA_KINDS = [
  "canonical-ir",
  "evidence",
  "evaluation-receipt",
  "interpretation-profile",
  "search-protocol",
  "methodology-inventory",
  "source-registry",
  "discrepancy",
  "release",
] as const;

/** A schema kind, e.g. `"canonical-ir"`. */
export type SchemaKind = (typeof SCHEMA_KINDS)[number];

/** Filename (relative to `schemas/`) for each kind. */
export const SCHEMA_FILES: Readonly<Record<SchemaKind, string>> = Object.freeze({
  "canonical-ir": "canonical-ir.schema.json",
  evidence: "evidence.schema.json",
  "evaluation-receipt": "evaluation-receipt.schema.json",
  "interpretation-profile": "interpretation-profile.schema.json",
  "search-protocol": "search-protocol.schema.json",
  "methodology-inventory": "methodology-inventory.schema.json",
  "source-registry": "source-registry.schema.json",
  discrepancy: "discrepancy.schema.json",
  release: "release.schema.json",
});

/** A JSON Schema document as a plain object. */
export type JsonSchema = Record<string, unknown>;

const SCHEMAS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas");

function loadSchema(kind: SchemaKind): JsonSchema {
  const source = readFileSync(join(SCHEMAS_DIR, SCHEMA_FILES[kind]), "utf8");
  return JSON.parse(source) as JsonSchema;
}

/** The parsed schema document for each kind, loaded once and frozen. */
export const RAW_SCHEMAS: Readonly<Record<SchemaKind, JsonSchema>> = Object.freeze(
  Object.fromEntries(SCHEMA_KINDS.map((kind) => [kind, Object.freeze(loadSchema(kind))])) as Record<
    SchemaKind,
    JsonSchema
  >,
);

/** The declared `$id` of each schema. */
export const SCHEMA_IDS: Readonly<Record<SchemaKind, string>> = Object.freeze(
  Object.fromEntries(
    SCHEMA_KINDS.map((kind) => [kind, String(RAW_SCHEMAS[kind].$id ?? "")]),
  ) as Record<SchemaKind, string>,
);

/** Read the raw bytes of a vendored schema file (used by the drift guard). */
export function readVendoredSchemaText(kind: SchemaKind): string {
  return readFileSync(join(SCHEMAS_DIR, SCHEMA_FILES[kind]), "utf8");
}

/** Absolute path to the vendored schema directory. */
export const VENDORED_SCHEMAS_DIR = SCHEMAS_DIR;

/** Return true if a string is a known schema kind. */
export function isSchemaKind(value: string): value is SchemaKind {
  return (SCHEMA_KINDS as readonly string[]).includes(value);
}
