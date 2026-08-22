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
const meta = (section: string): InvariantAuthority => ({
  kind: "meta",
  source: "adr/0020-deterministic-writ-verification.md",
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
    authority: meta("Scoped catalog and manifest reconciliation"),
  },
  {
    code: "INTEROP_SOURCE_NOT_FOUND",
    gate: "interoperability",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "INTEROP_TARGET_NOT_FOUND",
    gate: "interoperability",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "INTEROP_REFERENCE_AMBIGUOUS",
    gate: "interoperability",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "INTEROP_DECLARED_KIND_MISMATCH",
    gate: "interoperability",
    authority: schema(
      "schemas/core/record-link.schema.json",
      "1.0.0",
      "source_kind and target_kind reference declarations",
    ),
  },
  {
    code: "INTEROP_SUPPORT_NOT_FOUND",
    gate: "interoperability",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "INTEROP_EVIDENCE_NOT_FOUND",
    gate: "interoperability",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "INTEROP_OWNER_NOT_FOUND",
    gate: "interoperability",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "PROVENANCE_EVIDENCE_NOT_FOUND",
    gate: "provenance",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "PROVENANCE_SOURCE_NOT_FOUND",
    gate: "provenance",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "PROVENANCE_SOURCE_MISMATCH",
    gate: "provenance",
    authority: meta("Mechanical reference consistency"),
  },
  {
    code: "PROVENANCE_PASSAGE_CONFLICT",
    gate: "provenance",
    authority: meta("Mechanical reference consistency"),
  },
  {
    code: "PROVENANCE_PASSAGE_HASH_MISMATCH",
    gate: "provenance",
    authority: meta("Mechanical reference consistency"),
  },
  {
    code: "PROVENANCE_JUDGMENT_TARGET_NOT_FOUND",
    gate: "provenance",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "PROVENANCE_REFERENCE_AMBIGUOUS",
    gate: "provenance",
    authority: meta("Mechanical reference resolution"),
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
    authority: meta("Mechanical reference consistency"),
  },
  {
    code: "PROVENANCE_MIGRATION_HISTORY_INCONSISTENT",
    gate: "provenance",
    authority: meta("Mechanical reference consistency"),
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
    authority: meta("Mechanical path resolution"),
  },
  {
    code: "INTEGRITY_COUNT_MISMATCH",
    gate: "integrity",
    authority: meta("Scoped count reconciliation"),
  },
  {
    code: "INTEGRITY_REVIEW_COUNT_MISMATCH",
    gate: "integrity",
    authority: meta("Scoped count reconciliation"),
  },
  {
    code: "INTEGRITY_DANGLING_REFERENCE",
    gate: "integrity",
    authority: meta("Mechanical reference resolution"),
  },
  {
    code: "INTEGRITY_SOURCE_REGISTRY_DRIFT",
    gate: "integrity",
    authority: meta("Generated projection drift"),
  },
  {
    code: "INTEGRITY_CHECKSUM_MISMATCH",
    gate: "integrity",
    authority: meta("Checksum integrity"),
  },
  {
    code: "INTEGRITY_CHECKSUM_INVENTORY_MISMATCH",
    gate: "integrity",
    authority: meta("Checksum inventory integrity"),
  },
] as const;

export const INVARIANT_BY_CODE = new Map(INVARIANTS.map((item) => [item.code, item]));
