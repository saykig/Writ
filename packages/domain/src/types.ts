/**
 * Public re-exports of the generated schema types plus a compile-time map from
 * schema kind to its root interface. The generated files under `./generated`
 * are produced by `bun run generate`; a test guards them against drift.
 */
import type { CanonicalIr } from "./ir.js";
import type { Evidence } from "./generated/evidence.js";
import type { EvaluationReceipt } from "./generated/evaluation-receipt.js";
import type { InterpretationProfile } from "./generated/interpretation-profile.js";
import type { SearchProtocol } from "./generated/search-protocol.js";
import type { MethodologyInventory } from "./generated/methodology-inventory.js";
import type { SourceRegistry } from "./generated/source-registry.js";
import type { Discrepancy } from "./generated/discrepancy.js";
import type { Release } from "./generated/release.js";
import type {
  WritRecord,
  LegalPolicyRecord,
  InstitutionalRecord,
  RecordJudgment,
} from "./records.js";
import type { SchemaKind } from "./schemas.js";

export type {
  Evidence,
  EvaluationReceipt,
  InterpretationProfile,
  SearchProtocol,
  MethodologyInventory,
  SourceRegistry,
  Discrepancy,
  Release,
  WritRecord,
  LegalPolicyRecord,
  InstitutionalRecord,
  RecordJudgment,
};

/** Maps each schema kind to the TypeScript interface generated from it. */
export interface SchemaTypeMap {
  "canonical-ir": CanonicalIr;
  evidence: Evidence;
  "evaluation-receipt": EvaluationReceipt;
  "interpretation-profile": InterpretationProfile;
  "search-protocol": SearchProtocol;
  "methodology-inventory": MethodologyInventory;
  "source-registry": SourceRegistry;
  discrepancy: Discrepancy;
  release: Release;
  record: WritRecord;
  "legal-policy-record": LegalPolicyRecord;
  "institutional-record": InstitutionalRecord;
  "record-judgment": RecordJudgment;
}

/** The decoded value type for a given schema kind. */
export type SchemaTypeFor<K extends SchemaKind> = SchemaTypeMap[K];
