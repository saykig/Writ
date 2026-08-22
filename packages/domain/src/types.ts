/**
 * Public re-exports of the generated schema types plus a compile-time map from
 * schema kind to its root interface. The generated files under `./generated`
 * are produced by `bun run generate`; a test guards them against drift.
 */
import type { Evidence } from "./generated/evidence.js";
import type { SourceRegistry } from "./generated/source-registry.js";
import type {
  WritRecord,
  LegalPolicyRecord,
  InstitutionalRecord,
  RecordJudgment,
  RecordLink,
  CorpusManifest,
  CorpusCatalog,
} from "./records.js";
import type { SchemaKind } from "./schemas.js";

export type {
  Evidence,
  SourceRegistry,
  WritRecord,
  LegalPolicyRecord,
  InstitutionalRecord,
  RecordJudgment,
  RecordLink,
  CorpusManifest,
  CorpusCatalog,
};

/** Maps each schema kind to the TypeScript interface generated from it. */
export interface SchemaTypeMap {
  evidence: Evidence;
  "source-registry": SourceRegistry;
  record: WritRecord;
  "corpus-manifest": CorpusManifest;
  "corpus-catalog": CorpusCatalog;
  "record-link": RecordLink;
  "legal-policy-record": LegalPolicyRecord;
  "institutional-record": InstitutionalRecord;
  "record-judgment": RecordJudgment;
}

/** The decoded value type for a given schema kind. */
export type SchemaTypeFor<K extends SchemaKind> = SchemaTypeMap[K];
