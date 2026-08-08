import type {
  AtomicInstitutionalRecord,
  CurrentRecordJudgment,
  RecordLink,
  WritRecord,
} from "@writ/domain";

export type VerificationGate = "ontology" | "interoperability" | "provenance" | "integrity";
export type VerificationSeverity = "error" | "warning";

export interface VerificationIssue {
  gate: VerificationGate;
  code: string;
  severity: VerificationSeverity;
  message: string;
  corpus_id?: string;
  object_id?: string;
  file?: string;
}

export interface VerificationGateResult {
  gate: VerificationGate;
  passed: boolean;
  issues: VerificationIssue[];
}

export interface WritVerificationResult {
  passed: boolean;
  gates: VerificationGateResult[];
}

export interface CatalogEntry {
  corpus_id: string;
  family: "legal_policy" | "institutional";
  jurisdiction: string;
  status: string;
  path: string;
  manifest: string;
}

export interface CorpusCatalog {
  schema_version: string;
  implemented_native_families: string[];
  native_corpora: CatalogEntry[];
  retired_corpus_migrations: unknown[];
}

export interface RecordContract {
  kind: "native" | "compatibility";
  id: string;
  version: string;
}

export type ManifestCategory =
  "sources" | "passages" | "records" | "relationships" | "judgments" | "migration";

export interface CorpusManifest {
  schema_version: string;
  corpus_id: string;
  title: string;
  family: "legal_policy" | "institutional";
  jurisdiction: string;
  corpus_version: string;
  record_contract: RecordContract;
  status: string;
  root_institution_id?: string;
  record_counts: Record<string, number>;
  review_counts: Record<string, number>;
  unresolved_evidence_count: number;
  locations: Record<ManifestCategory, string[]>;
}

export interface Loaded<T> {
  value: T;
  file: string;
  corpus_id: string;
}

export interface LoadedDocument {
  value: Record<string, unknown>;
  file: string;
  corpus_id: string;
  category: ManifestCategory;
}

export interface IndexedObject {
  id: string;
  kind: string;
  value: Record<string, unknown>;
  file: string;
  corpus_id: string;
  aliases: string[];
}

export interface MappingQueueEntry {
  mapping_id: string;
  mapping_status: string;
  legal_policy_record_id: string | null;
  proposed_relation: string;
  target_institutional_id: string;
}

export interface MappingQueue {
  schema_version: "1.0.0";
  queue_id: string;
  status: string;
  active_link_ids: string[];
  mappings: MappingQueueEntry[];
  file: string;
}

export interface MigrationRename {
  previous_id: string;
  active_id: string;
  review_artifact?: string;
  file: string;
  corpus_id: string;
}

export interface RepositorySnapshot {
  root: string;
  catalog: CorpusCatalog;
  catalogEntries: CatalogEntry[];
  manifests: Loaded<CorpusManifest>[];
  records: Loaded<WritRecord>[];
  institutionalRecords: Loaded<AtomicInstitutionalRecord>[];
  links: Loaded<RecordLink>[];
  judgments: Loaded<CurrentRecordJudgment>[];
  documents: LoadedDocument[];
  objects: IndexedObject[];
  queues: MappingQueue[];
  migrations: MigrationRename[];
  loadIssues: VerificationIssue[];
}

export function issue(
  gate: VerificationGate,
  code: string,
  message: string,
  context: Partial<Pick<VerificationIssue, "corpus_id" | "object_id" | "file">> = {},
): VerificationIssue {
  return { gate, code, severity: "error", message, ...context };
}

export function gateResult(
  gate: VerificationGate,
  issues: VerificationIssue[],
): VerificationGateResult {
  return {
    gate,
    passed: !issues.some((item) => item.severity === "error"),
    issues: sortIssues(issues),
  };
}

export function sortIssues(issues: readonly VerificationIssue[]): VerificationIssue[] {
  return [...issues].sort((left, right) =>
    [
      left.gate,
      left.code,
      left.corpus_id ?? "",
      left.object_id ?? "",
      left.file ?? "",
      left.message,
    ]
      .join("\0")
      .localeCompare(
        [
          right.gate,
          right.code,
          right.corpus_id ?? "",
          right.object_id ?? "",
          right.file ?? "",
          right.message,
        ].join("\0"),
      ),
  );
}
