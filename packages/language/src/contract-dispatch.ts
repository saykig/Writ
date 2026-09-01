import {
  RAW_COMPATIBILITY_SCHEMAS,
  SCHEMA_IDS,
  type RecordJudgment,
  type WritRecord,
} from "@writ/domain";

export type SupportedWritDialect = "0.1" | "0.2";
export type CompiledSchemaVersion = WritRecord["schema_version"];

export interface ArtifactContract {
  readonly id: string;
  readonly schemaVersion: CompiledSchemaVersion;
}

export interface WritDialectContracts {
  readonly dialect: SupportedWritDialect;
  readonly records: {
    readonly base: ArtifactContract;
    readonly legal_policy: ArtifactContract;
    readonly institutional: ArtifactContract;
  };
  readonly judgment: ArtifactContract & {
    readonly schemaVersion: RecordJudgment["schema_version"];
  };
}

const compatibilityId = (kind: keyof typeof RAW_COMPATIBILITY_SCHEMAS): string =>
  String(RAW_COMPATIBILITY_SCHEMAS[kind].$id);

/**
 * The explicit source-dialect to compiled-contract mapping.
 *
 * The source header is the only dispatch input. Package and record versions are
 * independent revision metadata, and record payload fields never select a
 * schema. Dialect and schema versions are intentionally mapped rather than
 * assumed to be interchangeable strings.
 */
export const WRIT_DIALECT_CONTRACTS: Readonly<Record<SupportedWritDialect, WritDialectContracts>> =
  Object.freeze({
    "0.1": Object.freeze({
      dialect: "0.1",
      records: Object.freeze({
        base: Object.freeze({ id: compatibilityId("record"), schemaVersion: "0.1.0" }),
        legal_policy: Object.freeze({
          id: compatibilityId("legal-policy-record"),
          schemaVersion: "0.1.0",
        }),
        institutional: Object.freeze({
          id: compatibilityId("institutional-record"),
          schemaVersion: "0.1.0",
        }),
      }),
      judgment: Object.freeze({
        id: compatibilityId("record-judgment"),
        schemaVersion: "0.1.0",
      }),
    }),
    "0.2": Object.freeze({
      dialect: "0.2",
      records: Object.freeze({
        base: Object.freeze({ id: SCHEMA_IDS.record, schemaVersion: "0.2.0" }),
        legal_policy: Object.freeze({
          id: SCHEMA_IDS["legal-policy-record"],
          schemaVersion: "0.2.0",
        }),
        institutional: Object.freeze({
          id: SCHEMA_IDS["institutional-record"],
          schemaVersion: "0.2.0",
        }),
      }),
      judgment: Object.freeze({
        id: SCHEMA_IDS["record-judgment"],
        schemaVersion: "0.2.0",
      }),
    }),
  });

export function resolveWritDialect(dialect: string): WritDialectContracts | undefined {
  return WRIT_DIALECT_CONTRACTS[dialect as SupportedWritDialect];
}

export function recordContractForFamily(
  contracts: WritDialectContracts,
  family: string,
): ArtifactContract {
  if (family === "legal_policy") return contracts.records.legal_policy;
  if (family === "institutional") return contracts.records.institutional;
  return contracts.records.base;
}
