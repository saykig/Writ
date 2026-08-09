import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type {
  AtomicInstitutionalRecord,
  CurrentRecordJudgment,
  RecordLink,
  WritRecord,
} from "@writ/domain";
import { compileSource } from "@writ/language";

import { loadAuthorityIndex, renderSchemaErrors, type AuthorityIndex } from "./authority.js";
import {
  CURRENT_RECORD_ADAPTERS,
  INSTITUTIONAL_RECORD_SCHEMA,
  REVIEWED_DOCUMENT_SCHEMA,
  classifyRecordContract,
} from "./adapters/current-record-contracts.js";
import { CURRENT_WORKFLOW_ARTIFACTS } from "./adapters/workflow-artifacts.js";
import { resolveWorkspacePath } from "./core/workspace.js";
import {
  issue,
  type CatalogEntry,
  type CorpusCatalog,
  type CorpusManifest,
  type CrossFamilyHumanReview,
  type CrossFamilyReviewDecision,
  type IndexedObject,
  type Loaded,
  type LoadedDocument,
  type ManifestCategory,
  type MappingQueue,
  type MappingQueueEntry,
  type MigrationRename,
  type RepositorySnapshot,
  type VerificationIssue,
} from "./types.js";

const CATALOG_SCHEMA = "https://writ.example/schemas/core/corpus-catalog.schema.json";
const MANIFEST_SCHEMA = "https://writ.example/schemas/core/corpus-manifest.schema.json";
const RECORD_LINK_SCHEMA = "https://writ.example/schemas/core/record-link.schema.json";
const RECORD_JUDGMENT_SCHEMA = "https://writ.example/schemas/analysis/record-judgment.schema.json";
const CATEGORIES: readonly ManifestCategory[] = [
  "sources",
  "passages",
  "records",
  "relationships",
  "judgments",
  "migration",
];
const EMPTY_CATALOG: CorpusCatalog = {
  schema_version: "1.0.0",
  implemented_native_families: [],
  native_corpora: [],
  retired_corpus_migrations: [],
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function catalogEntry(value: unknown): value is CatalogEntry {
  return (
    object(value) &&
    nonEmpty(value.corpus_id) &&
    nonEmpty(value.family) &&
    nonEmpty(value.jurisdiction) &&
    nonEmpty(value.status) &&
    nonEmpty(value.path) &&
    nonEmpty(value.manifest)
  );
}

function corpusManifest(value: unknown): value is CorpusManifest {
  if (
    !object(value) ||
    !nonEmpty(value.schema_version) ||
    !nonEmpty(value.corpus_id) ||
    !nonEmpty(value.title) ||
    !nonEmpty(value.family) ||
    !nonEmpty(value.jurisdiction) ||
    !nonEmpty(value.corpus_version) ||
    !nonEmpty(value.status) ||
    !object(value.record_contract) ||
    (value.record_contract.kind !== "native" && value.record_contract.kind !== "compatibility") ||
    !nonEmpty(value.record_contract.id) ||
    !nonEmpty(value.record_contract.version) ||
    !object(value.locations) ||
    !object(value.record_counts) ||
    !object(value.review_counts) ||
    typeof value.unresolved_evidence_count !== "number"
  )
    return false;
  const locations = value.locations;
  return CATEGORIES.every(
    (category) => Array.isArray(locations[category]) && locations[category].every(nonEmpty),
  );
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const child = join(directory, name);
      return statSync(child).isDirectory() ? filesUnder(child) : [child];
    })
    .sort();
}

function structuredForCategory(category: ManifestCategory, file: string): boolean {
  if (file.endsWith(".writ")) return true;
  if (!file.endsWith(".yaml") && !file.endsWith(".yml") && !file.endsWith(".json")) return false;
  return category !== "sources" || !file.includes("/captures/");
}

function expandLocation(
  root: string,
  entry: CatalogEntry,
  manifestFile: string,
  category: ManifestCategory,
  location: string,
  issues: VerificationIssue[],
): string[] {
  const route = resolveWorkspacePath(root, entry.path, location);
  if (!route.ok) {
    issues.push(
      issue(
        "integrity",
        "INTEGRITY_ROUTED_FILE_MISSING",
        `Manifest location escapes the verification workspace: ${location}`,
        { corpus_id: entry.corpus_id, file: manifestFile },
      ),
    );
    return [];
  }
  const { absolute } = route;
  if (!existsSync(absolute)) {
    issues.push(
      issue(
        "integrity",
        "INTEGRITY_ROUTED_FILE_MISSING",
        `Manifest location does not exist: ${location}`,
        {
          corpus_id: entry.corpus_id,
          file: relative(root, absolute),
        },
      ),
    );
    return [];
  }
  const candidates = statSync(absolute).isDirectory() ? filesUnder(absolute) : [absolute];
  return candidates.filter((file) => structuredForCategory(category, file));
}

function parseStructured(file: string): unknown {
  const text = readFileSync(file, "utf8");
  return file.endsWith(".json") ? JSON.parse(text) : Bun.YAML.parse(text);
}

function ownerForFile(
  root: string,
  entries: readonly CatalogEntry[],
  file: string,
): string | undefined {
  const label = relative(root, file);
  return [...entries]
    .sort((left, right) => right.path.length - left.path.length)
    .find((entry) => label === entry.path || label.startsWith(`${entry.path}/`))?.corpus_id;
}

function validateDocument(
  authority: AuthorityIndex,
  schemaId: string,
  value: unknown,
  code: string,
  file: string,
  root: string,
  corpusId?: string,
): VerificationIssue[] {
  const result = authority.validate(schemaId, value);
  return result.valid
    ? []
    : [
        issue(
          "integrity",
          code,
          `Failed ${schemaId}: ${renderSchemaErrors(result.errors) || "schema could not be compiled"}`,
          {
            ...(corpusId ? { corpus_id: corpusId } : {}),
            file: relative(root, file),
          },
        ),
      ];
}

function indexed(
  value: Record<string, unknown>,
  kind: string,
  file: string,
  corpusId: string,
): IndexedObject | undefined {
  const id =
    typeof value.record_id === "string"
      ? value.record_id
      : typeof value.machine_id === "string"
        ? value.machine_id
        : typeof value.id === "string"
          ? value.id
          : undefined;
  if (!id) return undefined;
  return {
    id,
    kind,
    value,
    file,
    corpus_id: corpusId,
    aliases: [
      ...strings(value.aliases),
      ...strings(value.legacy_refs),
      ...(typeof value.ref === "string" ? [value.ref] : []),
    ],
  };
}

export function parseMappingQueueFile(
  file: string,
  root: string,
): { queue?: MappingQueue; issues: VerificationIssue[] } {
  const issues: VerificationIssue[] = [];
  let value: unknown;
  try {
    value = parseStructured(file);
  } catch (error) {
    return {
      issues: [
        issue(
          "interoperability",
          "INTEROP_QUEUE_INVALID",
          `Cannot parse mapping queue: ${String(error)}`,
          { file: relative(root, file) },
        ),
      ],
    };
  }
  if (!object(value) || typeof value.schema_version !== "string") {
    return {
      issues: [
        issue(
          "interoperability",
          "INTEROP_QUEUE_INVALID",
          "Mapping queue must declare schema_version.",
          { file: relative(root, file) },
        ),
      ],
    };
  }
  if (value.schema_version !== "1.0.0") {
    return {
      issues: [
        issue(
          "integrity",
          "VERIFIER_UNSUPPORTED_CONTRACT",
          `I recognize the mapping-queue workflow identity, but I do not have verified support for declared version ${value.schema_version}.`,
          { file: relative(root, file) },
        ),
      ],
    };
  }
  if (
    !nonEmpty(value.queue_id) ||
    value.status !== "human_review_complete" ||
    !nonEmpty(value.human_review_artifact) ||
    !Array.isArray(value.active_link_ids) ||
    !value.active_link_ids.every(nonEmpty) ||
    new Set(value.active_link_ids).size !== value.active_link_ids.length ||
    !Array.isArray(value.mappings)
  ) {
    issues.push(
      issue(
        "interoperability",
        "INTEROP_QUEUE_INVALID",
        "Mapping queue is malformed for adapter version 1.0.0.",
        { file: relative(root, file) },
      ),
    );
    return { issues };
  }
  const mappings: MappingQueueEntry[] = [];
  const mappingIds = new Set<string>();
  for (const candidate of value.mappings) {
    if (
      !object(candidate) ||
      !nonEmpty(candidate.mapping_id) ||
      (candidate.mapping_status !== "active_approved" &&
        candidate.mapping_status !== "unresolved") ||
      !(nonEmpty(candidate.legal_policy_record_id) || candidate.legal_policy_record_id === null) ||
      !nonEmpty(candidate.proposed_relation) ||
      !nonEmpty(candidate.target_institutional_id) ||
      (candidate.mapping_status === "active_approved" &&
        candidate.legal_policy_record_id === null) ||
      mappingIds.has(candidate.mapping_id)
    ) {
      issues.push(
        issue(
          "interoperability",
          "INTEROP_QUEUE_INVALID",
          "Mapping queue contains a malformed mapping for adapter version 1.0.0.",
          { file: relative(root, file) },
        ),
      );
      continue;
    }
    mappingIds.add(candidate.mapping_id);
    mappings.push(candidate as unknown as MappingQueueEntry);
  }
  if (issues.length > 0) return { issues };
  return {
    queue: {
      schema_version: "1.0.0",
      queue_id: value.queue_id,
      status: "human_review_complete",
      human_review_artifact: value.human_review_artifact,
      active_link_ids: value.active_link_ids as string[],
      mappings,
      file: relative(root, file),
    },
    issues: [],
  };
}

export function parseCrossFamilyHumanReviewDocument(
  value: Record<string, unknown>,
  file: string,
): { review?: CrossFamilyHumanReview; issues: VerificationIssue[] } {
  const invalid = (message: string): VerificationIssue =>
    issue("provenance", "PROVENANCE_HUMAN_REVIEW_INVALID", message, { file });
  if (!nonEmpty(value.schema_version)) {
    return { issues: [invalid("Cross-family human review must declare schema_version.")] };
  }
  if (value.schema_version !== "1.0.0") {
    return {
      issues: [
        issue(
          "integrity",
          "VERIFIER_UNSUPPORTED_CONTRACT",
          `I recognize the cross-family human-review workflow identity, but I do not have verified support for declared version ${value.schema_version}.`,
          { file },
        ),
      ],
    };
  }

  const proposalHistory = object(value.proposal_history) ? value.proposal_history : undefined;
  const revision = object(value.approved_id_revision) ? value.approved_id_revision : undefined;
  if (
    !nonEmpty(value.review_id) ||
    !nonEmpty(value.reviewer) ||
    value.review_type !== "human" ||
    value.status !== "complete" ||
    !proposalHistory ||
    !nonEmpty(proposalHistory.proposer) ||
    proposalHistory.proposed_link_review_state !== "draft" ||
    proposalHistory.proposed_judgment_status !== "proposed" ||
    proposalHistory.preserved_as !== "superseded_judgments" ||
    !revision ||
    !nonEmpty(revision.previous_approved_id) ||
    !nonEmpty(revision.active_id) ||
    revision.decision !== "approve" ||
    !Array.isArray(value.decisions)
  ) {
    return {
      issues: [invalid("Cross-family human review is malformed for adapter version 1.0.0.")],
    };
  }

  const decisions: CrossFamilyReviewDecision[] = [];
  const linkIds = new Set<string>();
  const acceptedJudgmentIds = new Set<string>();
  const proposalJudgmentIds = new Set<string>();
  for (const [index, candidate] of value.decisions.entries()) {
    if (
      !object(candidate) ||
      !nonEmpty(candidate.link_id) ||
      candidate.decision !== "approve" ||
      candidate.final_review_state !== "approved" ||
      !nonEmpty(candidate.reviewer) ||
      !nonEmpty(candidate.proposal_judgment_id) ||
      !nonEmpty(candidate.accepted_judgment_id) ||
      linkIds.has(candidate.link_id) ||
      acceptedJudgmentIds.has(candidate.accepted_judgment_id) ||
      proposalJudgmentIds.has(candidate.proposal_judgment_id)
    ) {
      return {
        issues: [
          invalid(
            `Cross-family human review decision[${index}] is malformed or duplicates a reviewed identifier.`,
          ),
        ],
      };
    }
    linkIds.add(candidate.link_id);
    acceptedJudgmentIds.add(candidate.accepted_judgment_id);
    proposalJudgmentIds.add(candidate.proposal_judgment_id);
    decisions.push({
      link_id: candidate.link_id,
      decision: "approve",
      final_review_state: "approved",
      reviewer: candidate.reviewer,
      proposal_judgment_id: candidate.proposal_judgment_id,
      accepted_judgment_id: candidate.accepted_judgment_id,
    });
  }

  return {
    review: {
      schema_version: "1.0.0",
      review_id: value.review_id,
      reviewer: value.reviewer,
      status: "complete",
      proposal_proposer: proposalHistory.proposer,
      proposed_link_review_state: "draft",
      proposed_judgment_status: "proposed",
      proposal_preserved_as: "superseded_judgments",
      approved_id_revision: {
        previous_id: revision.previous_approved_id,
        active_id: revision.active_id,
        decision: "approve",
      },
      decisions,
      file,
    },
    issues: [],
  };
}

function discoverWorkflowArtifacts(root: string): {
  queues: MappingQueue[];
  humanReviews: CrossFamilyHumanReview[];
  issues: VerificationIssue[];
} {
  const queues: MappingQueue[] = [];
  const humanReviews: CrossFamilyHumanReview[] = [];
  const issues: VerificationIssue[] = [];
  for (const registration of CURRENT_WORKFLOW_ARTIFACTS) {
    const route = resolveWorkspacePath(root, registration.queueArtifact);
    if (!route.ok || !existsSync(route.absolute)) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_ROUTED_FILE_MISSING",
          `Registered workflow artifact does not resolve: ${registration.queueArtifact}`,
          { file: registration.queueArtifact },
        ),
      );
      continue;
    }
    const parsed = parseMappingQueueFile(route.absolute, root);
    issues.push(...parsed.issues);
    if (parsed.queue) queues.push(parsed.queue);
  }
  const loadedReviewFiles = new Set<string>();
  for (const queue of queues) {
    const route = resolveWorkspacePath(root, queue.human_review_artifact);
    if (!route.ok || !existsSync(route.absolute)) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_HUMAN_REVIEW_INVALID",
          `Queue human-review artifact does not resolve: ${queue.human_review_artifact}`,
          { file: queue.file },
        ),
      );
      continue;
    }
    const reviewFile = route.absolute;
    const label = route.relative;
    const physical = realpathSync(reviewFile);
    if (loadedReviewFiles.has(physical)) continue;
    loadedReviewFiles.add(physical);
    let value: unknown;
    try {
      value = parseStructured(reviewFile);
    } catch (error) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_HUMAN_REVIEW_INVALID",
          `Cannot parse cross-family human review: ${String(error)}`,
          { file: label },
        ),
      );
      continue;
    }
    if (!object(value)) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_HUMAN_REVIEW_INVALID",
          "Cross-family human review must contain an object.",
          { file: label },
        ),
      );
      continue;
    }
    const review = parseCrossFamilyHumanReviewDocument(value, label);
    issues.push(...review.issues);
    if (review.review) humanReviews.push(review.review);
  }
  return { queues, humanReviews, issues };
}

export function parseInstitutionalMigrationDocument(
  value: Record<string, unknown>,
  file: string,
  corpusId: string,
): { renames: MigrationRename[]; issues: VerificationIssue[] } {
  const renames: MigrationRename[] = [];
  const issues: VerificationIssue[] = [];
  const invalid = (message: string): void => {
    issues.push(
      issue("provenance", "PROVENANCE_MIGRATION_INVALID", message, {
        corpus_id: corpusId,
        file,
      }),
    );
  };
  if (typeof value.schema_version !== "string") {
    invalid("Native institutional migration must declare schema_version.");
    return { renames, issues };
  }
  if (value.schema_version !== "1.0.0") {
    issues.push(
      issue(
        "integrity",
        "VERIFIER_UNSUPPORTED_CONTRACT",
        `I recognize the native institutional migration workflow identity, but I do not have verified support for declared version ${value.schema_version}.`,
        { corpus_id: corpusId, file },
      ),
    );
    return { renames, issues };
  }

  const parseApprovedRenames = (container: Record<string, unknown>, field: string): void => {
    if (!("approved_id_renames" in container)) return;
    if (!Array.isArray(container.approved_id_renames)) {
      invalid(`${field}.approved_id_renames must be an array.`);
      return;
    }
    for (const [index, candidate] of container.approved_id_renames.entries()) {
      if (
        !object(candidate) ||
        typeof candidate.previous_draft_id !== "string" ||
        candidate.previous_draft_id.length === 0 ||
        typeof candidate.approved_id !== "string" ||
        candidate.approved_id.length === 0
      ) {
        invalid(
          `${field}.approved_id_renames[${index}] must declare non-empty previous_draft_id and approved_id.`,
        );
        continue;
      }
      renames.push({
        previous_id: candidate.previous_draft_id,
        active_id: candidate.approved_id,
        file,
        corpus_id: corpusId,
      });
    }
  };

  parseApprovedRenames(value, "migration");
  if ("stage_b_review" in value) {
    if (!object(value.stage_b_review)) invalid("stage_b_review must be an object when present.");
    else parseApprovedRenames(value.stage_b_review, "stage_b_review");
  }

  if ("post_review_id_renames" in value) {
    if (!Array.isArray(value.post_review_id_renames)) {
      invalid("post_review_id_renames must be an array.");
    } else {
      for (const [index, candidate] of value.post_review_id_renames.entries()) {
        if (
          !object(candidate) ||
          typeof candidate.previous_approved_id !== "string" ||
          candidate.previous_approved_id.length === 0 ||
          typeof candidate.active_id !== "string" ||
          candidate.active_id.length === 0 ||
          (candidate.review_artifact !== undefined && typeof candidate.review_artifact !== "string")
        ) {
          invalid(
            `post_review_id_renames[${index}] must declare non-empty previous_approved_id and active_id, with a string review_artifact when present.`,
          );
          continue;
        }
        renames.push({
          previous_id: candidate.previous_approved_id,
          active_id: candidate.active_id,
          ...(typeof candidate.review_artifact === "string"
            ? { review_artifact: candidate.review_artifact }
            : {}),
          file,
          corpus_id: corpusId,
        });
      }
    }
  }
  return { renames, issues };
}

export interface LoadRepositoryResult {
  snapshot: RepositorySnapshot;
  authority: AuthorityIndex;
}

export function loadRepository(root: string): LoadRepositoryResult {
  const authority = loadAuthorityIndex(root);
  const loadIssues: VerificationIssue[] = [...authority.issues];
  const catalogFile = join(root, "corpora", "catalog.yaml");
  let catalogValue: unknown;
  try {
    catalogValue = parseStructured(catalogFile);
  } catch {
    loadIssues.push(
      issue("integrity", "INTEGRITY_CATALOG_INVALID", "Cannot parse corpora/catalog.yaml.", {
        file: "corpora/catalog.yaml",
      }),
    );
  }
  if (catalogValue !== undefined) {
    loadIssues.push(
      ...validateDocument(
        authority,
        CATALOG_SCHEMA,
        catalogValue,
        "INTEGRITY_CATALOG_INVALID",
        catalogFile,
        root,
      ),
    );
  }
  const rawEntries =
    object(catalogValue) && Array.isArray(catalogValue.native_corpora)
      ? catalogValue.native_corpora
      : [];
  const entries: CatalogEntry[] = [];
  for (const candidate of rawEntries) {
    if (!catalogEntry(candidate)) continue;
    const corpusRoute = resolveWorkspacePath(root, candidate.path);
    if (!corpusRoute.ok) {
      loadIssues.push(
        issue(
          "integrity",
          "INTEGRITY_ROUTED_FILE_MISSING",
          `Catalog corpus path escapes the verification workspace: ${candidate.path}`,
          { corpus_id: candidate.corpus_id, file: "corpora/catalog.yaml" },
        ),
      );
      continue;
    }
    entries.push(candidate);
  }
  const catalog: CorpusCatalog = object(catalogValue)
    ? {
        schema_version: nonEmpty(catalogValue.schema_version)
          ? catalogValue.schema_version
          : EMPTY_CATALOG.schema_version,
        implemented_native_families: strings(catalogValue.implemented_native_families),
        native_corpora: entries,
        retired_corpus_migrations: Array.isArray(catalogValue.retired_corpus_migrations)
          ? catalogValue.retired_corpus_migrations
          : [],
      }
    : EMPTY_CATALOG;
  const manifests: Loaded<CorpusManifest>[] = [];
  for (const entry of entries) {
    const manifestRoute = resolveWorkspacePath(root, entry.manifest);
    if (!manifestRoute.ok) {
      loadIssues.push(
        issue(
          "integrity",
          "INTEGRITY_ROUTED_FILE_MISSING",
          `Catalog manifest path escapes the verification workspace: ${entry.manifest}`,
          { corpus_id: entry.corpus_id, file: "corpora/catalog.yaml" },
        ),
      );
      continue;
    }
    const file = manifestRoute.absolute;
    if (!existsSync(file)) {
      loadIssues.push(
        issue("integrity", "INTEGRITY_ROUTED_FILE_MISSING", "Catalogued manifest does not exist.", {
          corpus_id: entry.corpus_id,
          file: manifestRoute.relative,
        }),
      );
      continue;
    }
    let value: unknown;
    try {
      value = parseStructured(file);
    } catch {
      loadIssues.push(
        issue("integrity", "INTEGRITY_MANIFEST_INVALID", "Cannot parse corpus manifest.", {
          corpus_id: entry.corpus_id,
          file: manifestRoute.relative,
        }),
      );
      continue;
    }
    const manifestIssues = validateDocument(
      authority,
      MANIFEST_SCHEMA,
      value,
      "INTEGRITY_MANIFEST_INVALID",
      file,
      root,
      entry.corpus_id,
    );
    loadIssues.push(...manifestIssues);
    if (manifestIssues.length > 0 || !corpusManifest(value)) continue;
    manifests.push({
      value,
      file: manifestRoute.relative,
      corpus_id: entry.corpus_id,
    });
  }

  const records: Loaded<WritRecord>[] = [];
  const institutionalRecords: Loaded<AtomicInstitutionalRecord>[] = [];
  const links: Loaded<RecordLink>[] = [];
  const judgments: Loaded<CurrentRecordJudgment>[] = [];
  const documents: LoadedDocument[] = [];
  const objectMap = new Map<string, IndexedObject>();
  const migrations: MigrationRename[] = [];
  const routed = new Set<string>();

  const addObject = (item: IndexedObject): void => {
    const physical = realpathSync(join(root, item.file));
    const key = `${physical}\0${item.kind}\0${item.id}`;
    if (!objectMap.has(key)) objectMap.set(key, item);
  };

  for (const loadedManifest of manifests) {
    const manifest = loadedManifest.value;
    const entry = entries.find((item) => item.corpus_id === manifest.corpus_id);
    if (!entry) continue;
    const contract = manifest.record_contract;
    const support = classifyRecordContract(authority, contract.id, contract.version);
    if (support === "invalid") {
      loadIssues.push(
        issue(
          "integrity",
          "INTEGRITY_CONTRACT_INVALID",
          `Manifest contract ID does not resolve in schemas/: ${contract.id}`,
          { corpus_id: manifest.corpus_id, file: loadedManifest.file },
        ),
      );
      continue;
    }
    if (support === "unsupported") {
      loadIssues.push(
        issue(
          "integrity",
          "VERIFIER_UNSUPPORTED_CONTRACT",
          `I recognize authoritative contract ${contract.id}, but I do not have verified support for exact declared version ${contract.version}.`,
          { corpus_id: manifest.corpus_id, file: loadedManifest.file },
        ),
      );
      continue;
    }
    for (const category of CATEGORIES) {
      for (const location of manifest.locations[category] ?? []) {
        for (const absolute of expandLocation(
          root,
          entry,
          loadedManifest.file,
          category,
          location,
          loadIssues,
        )) {
          const label = relative(root, absolute);
          // A physical compatibility document may be listed by its owning corpus and
          // by an institutional consumer. Its canonical owner controls parsing and
          // validation regardless of which route is encountered first.
          const ownerCorpus = ownerForFile(root, entries, absolute) ?? manifest.corpus_id;
          const governingManifest =
            manifests.find((candidate) => candidate.value.corpus_id === ownerCorpus) ??
            loadedManifest;
          const governingContract = governingManifest.value.record_contract;
          const governingAdapter = CURRENT_RECORD_ADAPTERS.resolve(
            governingContract.id,
            governingContract.version,
          );
          if (!governingAdapter) continue;
          const routeKey = `${realpathSync(absolute)}\0${category}`;
          if (routed.has(routeKey)) continue;
          routed.add(routeKey);

          if (absolute.endsWith(".writ")) {
            if (category !== "records" && category !== "judgments") continue;
            const compiled = compileSource(readFileSync(absolute, "utf8"), { fileName: label });
            const errors = compiled.diagnostics.filter(
              (diagnostic) => diagnostic.severity === "error",
            );
            if (errors.length > 0) {
              loadIssues.push(
                issue(
                  "integrity",
                  "INTEGRITY_CONTRACT_INVALID",
                  `Writ compilation failed: ${errors.map((item) => item.message).join("; ")}`,
                  { corpus_id: ownerCorpus, file: label },
                ),
              );
              continue;
            }
            if (category === "records") {
              for (const record of compiled.records) {
                const adapted = governingAdapter.adapt({
                  family: record.family,
                  value: record,
                });
                loadIssues.push(
                  ...validateDocument(
                    authority,
                    governingContract.id,
                    record,
                    "INTEGRITY_CONTRACT_INVALID",
                    absolute,
                    root,
                    ownerCorpus,
                  ),
                );
                const loaded = { value: record, file: label, corpus_id: ownerCorpus };
                records.push(loaded);
                if (
                  adapted.adapterKind === "compiled_native" &&
                  governingContract.id === INSTITUTIONAL_RECORD_SCHEMA &&
                  record.schema_version === "0.2.0"
                )
                  institutionalRecords.push(loaded as Loaded<AtomicInstitutionalRecord>);
                const recordObject = indexed(
                  record as unknown as Record<string, unknown>,
                  "record",
                  label,
                  ownerCorpus,
                );
                if (recordObject) addObject(recordObject);
                for (const evidence of record.evidence) {
                  addObject({
                    id: evidence.passage_id,
                    kind: "passage",
                    value: evidence as unknown as Record<string, unknown>,
                    file: label,
                    corpus_id: ownerCorpus,
                    aliases: [],
                  });
                  addObject({
                    id: evidence.source_id,
                    // V1 reconstructs this from a compiled record's evidence envelope.
                    // It is a resolvable reference, not an independently loaded source document.
                    kind: "evidence_source_reference",
                    value: evidence as unknown as Record<string, unknown>,
                    file: label,
                    corpus_id: ownerCorpus,
                    aliases: [evidence.document_version_id],
                  });
                }
              }
            } else {
              for (const judgment of compiled.judgments) {
                loadIssues.push(
                  ...validateDocument(
                    authority,
                    RECORD_JUDGMENT_SCHEMA,
                    judgment,
                    "INTEGRITY_CONTRACT_INVALID",
                    absolute,
                    root,
                    ownerCorpus,
                  ),
                );
                judgments.push({
                  value: judgment as CurrentRecordJudgment,
                  file: label,
                  corpus_id: ownerCorpus,
                });
                const judgmentObject = indexed(
                  judgment as unknown as Record<string, unknown>,
                  "judgment",
                  label,
                  ownerCorpus,
                );
                if (judgmentObject) addObject(judgmentObject);
              }
            }
            continue;
          }

          let value: unknown;
          try {
            value = parseStructured(absolute);
          } catch (error) {
            loadIssues.push(
              issue(
                "integrity",
                "INTEGRITY_CONTRACT_INVALID",
                `Cannot parse structured manifest location: ${String(error)}`,
                { corpus_id: ownerCorpus, file: label },
              ),
            );
            continue;
          }
          if (!object(value)) {
            loadIssues.push(
              issue(
                "integrity",
                "INTEGRITY_CONTRACT_INVALID",
                "Structured manifest location must contain an object.",
                { corpus_id: ownerCorpus, file: label },
              ),
            );
            continue;
          }
          documents.push({ value, file: label, corpus_id: ownerCorpus, category });

          if (governingContract.id === REVIEWED_DOCUMENT_SCHEMA) {
            governingAdapter.adapt({ family: governingManifest.value.family, value });
            loadIssues.push(
              ...validateDocument(
                authority,
                governingContract.id,
                value,
                "INTEGRITY_CONTRACT_INVALID",
                absolute,
                root,
                ownerCorpus,
              ),
            );
            const keysByCategory: Record<ManifestCategory, string[]> = {
              sources: ["sources"],
              passages: ["passages", "unresolved"],
              records: ["entities", "claims"],
              relationships: ["relationships"],
              judgments: ["parent_annotations", "reviews", "reconciliation"],
              migration: ["entries"],
            };
            for (const key of keysByCategory[category]) {
              for (const candidate of Array.isArray(value[key]) ? value[key] : []) {
                if (!object(candidate)) continue;
                const kind =
                  key === "claims"
                    ? "legal_policy_claim"
                    : key === "passages"
                      ? "passage"
                      : key === "sources"
                        ? candidate.record_type === "source_document_version"
                          ? "source_document"
                          : "source"
                        : key.replace(/s$/, "");
                const item = indexed(candidate, kind, label, ownerCorpus);
                if (item) addObject(item);
              }
            }
          } else if (category === "relationships") {
            loadIssues.push(
              ...validateDocument(
                authority,
                RECORD_LINK_SCHEMA,
                value,
                "INTEGRITY_CONTRACT_INVALID",
                absolute,
                root,
                ownerCorpus,
              ),
            );
            links.push({
              value: value as unknown as RecordLink,
              file: label,
              corpus_id: ownerCorpus,
            });
            const linkObject = indexed(
              { ...value, record_id: value.link_id },
              "record_link",
              label,
              ownerCorpus,
            );
            if (linkObject) addObject(linkObject);
          } else if (
            category === "migration" &&
            governingContract.kind === "native" &&
            governingContract.id === INSTITUTIONAL_RECORD_SCHEMA &&
            governingContract.version === "0.2.0"
          ) {
            const parsed = parseInstitutionalMigrationDocument(value, label, ownerCorpus);
            migrations.push(...parsed.renames);
            loadIssues.push(...parsed.issues);
          }
        }
      }
    }
  }

  const workflow = discoverWorkflowArtifacts(root);
  loadIssues.push(...workflow.issues);
  return {
    authority,
    snapshot: {
      root,
      catalog,
      catalogEntries: entries,
      manifests,
      records,
      institutionalRecords,
      links,
      judgments,
      documents,
      objects: [...objectMap.values()],
      queues: workflow.queues,
      humanReviews: workflow.humanReviews,
      migrations,
      loadIssues,
    },
  };
}

export function findObjects(
  snapshot: RepositorySnapshot,
  id: string,
  kinds?: readonly string[],
): IndexedObject[] {
  return snapshot.objects.filter(
    (item) =>
      (item.id === id || item.aliases.includes(id)) && (!kinds || kinds.includes(item.kind)),
  );
}

export function repositoryRoot(from: string = import.meta.dir): string {
  let cursor = resolve(from);
  while (true) {
    if (existsSync(join(cursor, "AGENTS.md")) && existsSync(join(cursor, "schemas"))) return cursor;
    const parent = resolve(cursor, "..");
    if (parent === cursor || isAbsolute(cursor) === false)
      throw new Error("Cannot locate Writ repository root");
    cursor = parent;
  }
}
