import type { VerificationGate } from "./types.js";

export interface InvariantAuthority {
  kind: "schema" | "adr" | "core_contract" | "manifest_contract" | "mechanical" | "meta";
  source: string;
  version?: string;
  section: string;
}

export interface InvariantDefinition {
  code: string;
  gate: VerificationGate;
  authority: InvariantAuthority;
}

const schema = (source: string, version: string, section: string): InvariantAuthority => ({
  kind: "schema",
  source,
  version,
  section,
});
const adr19 = (section: string): InvariantAuthority => ({
  kind: "adr",
  source: "adr/0019-cross-family-interoperability.md",
  section,
});
const mechanical = (section: string): InvariantAuthority => ({
  kind: "mechanical",
  source: "docs/migrations/internal-repository-support.md",
  section,
});
const meta = (section: string): InvariantAuthority => ({
  kind: "meta",
  source: "adr/0020-deterministic-pre-merge-verification.md",
  section,
});

export const INVARIANTS: readonly InvariantDefinition[] = [
  {
    code: "VERIFIER_UNSUPPORTED_CONTRACT",
    gate: "integrity",
    authority: meta("Exact adapter support"),
  },
  {
    code: "VERIFIER_AUTHORITY_CONFLICT",
    gate: "integrity",
    authority: meta("Authority conflicts"),
  },
  {
    code: "ONTOLOGY_FAMILY_MISMATCH",
    gate: "ontology",
    authority: schema("schemas/core/corpus-manifest.schema.json", "1.0.0", "family"),
  },
  {
    code: "ONTOLOGY_IDENTITY_NOT_FOUND",
    gate: "ontology",
    authority: adr19("Canonical institutional identity"),
  },
  {
    code: "ONTOLOGY_IDENTITY_AMBIGUOUS",
    gate: "ontology",
    authority: adr19("Canonical institutional identity"),
  },
  {
    code: "ONTOLOGY_INVALID_SOURCE_KIND",
    gate: "ontology",
    authority: adr19("Relation endpoint contract"),
  },
  {
    code: "ONTOLOGY_INVALID_TARGET_KIND",
    gate: "ontology",
    authority: adr19("Relation endpoint contract"),
  },
  {
    code: "ONTOLOGY_PLACEMENT_SUPPORT_INCOMPATIBLE",
    gate: "ontology",
    authority: adr19("Fact/link distinction"),
  },
  {
    code: "INTEROP_SOURCE_NOT_FOUND",
    gate: "interoperability",
    authority: adr19("Relation endpoint contract"),
  },
  {
    code: "INTEROP_TARGET_NOT_FOUND",
    gate: "interoperability",
    authority: adr19("Canonical institutional identity"),
  },
  {
    code: "INTEROP_REFERENCE_AMBIGUOUS",
    gate: "interoperability",
    authority: mechanical("Declared reference resolution"),
  },
  {
    code: "INTEROP_SUPPORT_NOT_FOUND",
    gate: "interoperability",
    authority: schema("schemas/core/record-link.schema.json", "1.0.0", "supporting_record_ids"),
  },
  {
    code: "INTEROP_SUPPORT_ENDPOINT_MISMATCH",
    gate: "interoperability",
    authority: adr19("Inherited supporting records"),
  },
  {
    code: "INTEROP_EVIDENCE_NOT_FOUND",
    gate: "interoperability",
    authority: schema("schemas/core/record-link.schema.json", "1.0.0", "evidence_refs"),
  },
  {
    code: "INTEROP_OWNER_NOT_FOUND",
    gate: "interoperability",
    authority: schema("schemas/core/record-link.schema.json", "1.0.0", "owning_corpus_id"),
  },
  {
    code: "INTEROP_OWNER_MISMATCH",
    gate: "interoperability",
    authority: adr19("Institution-owned storage"),
  },
  {
    code: "INTEROP_INVERSE_DUPLICATE",
    gate: "interoperability",
    authority: adr19("Reverse traversal"),
  },
  {
    code: "INTEROP_UNRESOLVED_ACTIVE",
    gate: "interoperability",
    authority: adr19("Unresolved mappings"),
  },
  {
    code: "INTEROP_ACTIVE_SET_MISMATCH",
    gate: "interoperability",
    authority: adr19("Reviewed mapping workflow"),
  },
  {
    code: "INTEROP_QUEUE_INVALID",
    gate: "interoperability",
    authority: adr19("Unresolved mappings"),
  },
  {
    code: "PROVENANCE_EVIDENCE_NOT_FOUND",
    gate: "provenance",
    authority: schema("schemas/core/record.schema.json", "0.2.0", "evidence"),
  },
  {
    code: "PROVENANCE_DISPOSITION_MISSING",
    gate: "provenance",
    authority: adr19("Independent link review"),
  },
  {
    code: "PROVENANCE_DRAFT_HUMAN_MISMATCH",
    gate: "provenance",
    authority: adr19("Independent link review"),
  },
  {
    code: "PROVENANCE_AUTOMATION_ATTRIBUTION",
    gate: "provenance",
    authority: adr19("Automated proposal history"),
  },
  {
    code: "PROVENANCE_JUDGMENT_TARGET_NOT_FOUND",
    gate: "provenance",
    authority: schema("schemas/analysis/record-judgment.schema.json", "0.2.0", "target_id"),
  },
  {
    code: "PROVENANCE_REFERENCE_AMBIGUOUS",
    gate: "provenance",
    authority: mechanical("Declared reference resolution"),
  },
  {
    code: "PROVENANCE_SUPERSESSION_INVALID",
    gate: "provenance",
    authority: {
      kind: "core_contract",
      source: "packages/domain/src/judgments.ts",
      version: "0.2.0",
      section: "validateJudgmentSupersession",
    },
  },
  {
    code: "PROVENANCE_ACTIVE_LEGACY_ID",
    gate: "provenance",
    authority: adr19("Approved identifier migration"),
  },
  {
    code: "PROVENANCE_MIGRATION_HISTORY_INCONSISTENT",
    gate: "provenance",
    authority: adr19("Approved identifier migration"),
  },
  {
    code: "PROVENANCE_MIGRATION_INVALID",
    gate: "provenance",
    authority: meta("Exact workflow adapter support"),
  },
  {
    code: "INTEGRITY_CATALOG_INVALID",
    gate: "integrity",
    authority: schema("schemas/core/corpus-catalog.schema.json", "1.0.0", "document"),
  },
  {
    code: "INTEGRITY_MANIFEST_INVALID",
    gate: "integrity",
    authority: schema("schemas/core/corpus-manifest.schema.json", "1.0.0", "document"),
  },
  {
    code: "INTEGRITY_CONTRACT_INVALID",
    gate: "integrity",
    authority: meta("Authoritative schema resolution"),
  },
  {
    code: "INTEGRITY_ROUTED_FILE_MISSING",
    gate: "integrity",
    authority: schema("schemas/core/corpus-manifest.schema.json", "1.0.0", "locations"),
  },
  {
    code: "INTEGRITY_COUNT_MISMATCH",
    gate: "integrity",
    authority: schema("schemas/core/corpus-manifest.schema.json", "1.0.0", "record_counts"),
  },
  {
    code: "INTEGRITY_REVIEW_COUNT_MISMATCH",
    gate: "integrity",
    authority: schema("schemas/core/corpus-manifest.schema.json", "1.0.0", "review_counts"),
  },
  {
    code: "INTEGRITY_DANGLING_REFERENCE",
    gate: "integrity",
    authority: mechanical("Declared reference resolution"),
  },
  {
    code: "INTEGRITY_CATALOG_PROJECTION_DRIFT",
    gate: "integrity",
    authority: mechanical("Generated material"),
  },
  {
    code: "INTEGRITY_SOURCE_REGISTRY_DRIFT",
    gate: "integrity",
    authority: mechanical("Generated material"),
  },
  {
    code: "INTEGRITY_CHECKSUM_MISMATCH",
    gate: "integrity",
    authority: mechanical("Complete tracked-tree checksum"),
  },
  {
    code: "INTEGRITY_CHECKSUM_INVENTORY_MISMATCH",
    gate: "integrity",
    authority: mechanical("Complete tracked-tree checksum"),
  },
] as const;

export const INVARIANT_BY_CODE = new Map(INVARIANTS.map((item) => [item.code, item]));
