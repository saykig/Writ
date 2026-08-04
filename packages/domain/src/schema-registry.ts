/**
 * Schema-version registry: maps `(kind, schema_version)` to schema identity and
 * metadata so future migrations can look up prior versions. Every current
 * contract declares `schema_version` `"1.0.0"`; new versions are added here
 * additively (a version's meaning is never repurposed).
 */
import { RAW_SCHEMAS, SCHEMA_IDS, SCHEMA_KINDS, type SchemaKind } from "./schemas.js";

/** Metadata for one concrete schema version. */
export interface SchemaVersionEntry {
  /** The schema kind this version belongs to. */
  kind: SchemaKind;
  /** The `schema_version` value (e.g. `"1.0.0"`). */
  schemaVersion: string;
  /** The schema `$id`. */
  schemaId: string;
  /** The schema `title`. */
  title: string;
}

/** All known versions for a kind, with a pointer to the current one. */
export interface SchemaRegistryEntry {
  kind: SchemaKind;
  /** The `schema_version` considered current for this kind. */
  current: string;
  /** Every known version, keyed by `schema_version`. */
  versions: Readonly<Record<string, SchemaVersionEntry>>;
}

/**
 * Extract the declared `schema_version` const from a vendored schema. Family
 * extensions inherit the version from the shared record base rather than
 * duplicating that property.
 */
function declaredVersion(kind: SchemaKind): string {
  const schema = RAW_SCHEMAS[kind];
  const rootProperties = schema.properties as
    { schema_version?: { const?: unknown; $ref?: unknown } } | undefined;
  const defs = schema.$defs as
    | Record<
        string,
        {
          const?: unknown;
          properties?: { schema_version?: { const?: unknown; $ref?: unknown } };
        }
      >
    | undefined;
  const baseProperties = defs?.recordBase?.properties;
  const versionProperty = rootProperties?.schema_version ?? baseProperties?.schema_version;
  let constValue = versionProperty?.const;
  if (constValue === undefined && typeof versionProperty?.$ref === "string") {
    const match = versionProperty.$ref.match(/^#\/\$defs\/([^/]+)$/);
    constValue = match ? defs?.[match[1]!]?.const : undefined;
  }
  if (constValue === undefined && kind !== "record") {
    const allOf = schema.allOf as Array<{ $ref?: unknown }> | undefined;
    const inheritsRecordBase = allOf?.some(
      (item) =>
        item.$ref === "https://writ.example/schemas/core/record.schema.json#/$defs/recordBase",
    );
    if (inheritsRecordBase) return declaredVersion("record");
  }
  return typeof constValue === "string" ? constValue : "unknown";
}

function declaredTitle(kind: SchemaKind): string {
  const title = RAW_SCHEMAS[kind].title;
  return typeof title === "string" ? title : kind;
}

/** The registry, keyed by schema kind. */
export const SCHEMA_REGISTRY: Readonly<Record<SchemaKind, SchemaRegistryEntry>> = Object.freeze(
  Object.fromEntries(
    SCHEMA_KINDS.map((kind) => {
      const schemaVersion = declaredVersion(kind);
      const entry: SchemaVersionEntry = {
        kind,
        schemaVersion,
        schemaId: SCHEMA_IDS[kind],
        title: declaredTitle(kind),
      };
      const registryEntry: SchemaRegistryEntry = {
        kind,
        current: schemaVersion,
        versions: Object.freeze({ [schemaVersion]: Object.freeze(entry) }),
      };
      return [kind, Object.freeze(registryEntry)];
    }),
  ) as Record<SchemaKind, SchemaRegistryEntry>,
);

/**
 * Look up metadata for a specific `(kind, schemaVersion)`. When `schemaVersion`
 * is omitted, the current version for the kind is returned. Returns `undefined`
 * for an unknown version (never silently coerces).
 */
export function resolveSchemaVersion(
  kind: SchemaKind,
  schemaVersion?: string,
): SchemaVersionEntry | undefined {
  const entry = SCHEMA_REGISTRY[kind];
  const version = schemaVersion ?? entry.current;
  return entry.versions[version];
}

/** The current `schema_version` for a kind. */
export function currentSchemaVersion(kind: SchemaKind): string {
  return SCHEMA_REGISTRY[kind].current;
}
