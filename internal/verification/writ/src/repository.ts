import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { AtomicInstitutionalRecord, CurrentRecordJudgment, RecordLink } from "@writ/domain";
import { compileSource, isConceptDeclaration, isSource, parseDocument } from "@writ/language";

import { loadAuthorityIndex, renderSchemaErrors, type AuthorityIndex } from "./authority.js";
import {
  CURRENT_RECORD_ADAPTERS,
  INSTITUTIONAL_RECORD_SCHEMA,
  REVIEWED_DOCUMENT_SCHEMA,
  classifyRecordContract,
} from "./adapters/current-record-contracts.js";
import {
  CURRENT_WORKFLOW_ADAPTERS,
  CURRENT_WORKFLOW_REGISTRATIONS,
} from "./adapters/current-workflows.js";
import { discoverWorkflowArtifacts } from "./adapters/workflow-artifacts.js";
import { resolveWorkspacePath } from "./core/workspace.js";
import {
  issue,
  type CatalogEntry,
  type CorpusCatalog,
  type CorpusManifest,
  type IndexedObject,
  type Loaded,
  type LoadedDocument,
  type LoadedRecord,
  type ManifestCategory,
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

function declarationProperties(
  properties: readonly {
    readonly $type: string;
    readonly name?: string;
    readonly value?: unknown;
  }[],
): ReadonlyMap<string, unknown> {
  return new Map(
    properties.map((property) => [property.name ?? property.$type, property.value] as const),
  );
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

  const records: LoadedRecord[] = [];
  const institutionalRecords: LoadedRecord<AtomicInstitutionalRecord>[] = [];
  const links: Loaded<RecordLink>[] = [];
  const judgments: Loaded<CurrentRecordJudgment>[] = [];
  const documents: LoadedDocument[] = [];
  const objectMap = new Map<string, IndexedObject>();
  const migrations: MigrationRename[] = [];
  const routed = new Set<string>();
  const sourceRouteMap = new Map<string, { corpus_id: string; file: string }>();

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
          if (category === "sources") {
            const physical = realpathSync(absolute);
            sourceRouteMap.set(`${manifest.corpus_id}\0${physical}`, {
              corpus_id: manifest.corpus_id,
              file: label,
            });
          }
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
            if (category === "sources") {
              const parsed = parseDocument(readFileSync(absolute, "utf8"), { fileName: label });
              const errors = parsed.diagnostics.filter(
                (diagnostic) => diagnostic.severity === "error",
              );
              if (!parsed.ok || errors.length > 0) {
                loadIssues.push(
                  issue(
                    "integrity",
                    "INTEGRITY_CONTRACT_INVALID",
                    `Writ source metadata parsing failed: ${errors.map((item) => item.message).join("; ")}`,
                    { corpus_id: ownerCorpus, file: label },
                  ),
                );
                continue;
              }
              const documentVersions = new Map<string, string>();
              for (const declaration of parsed.model.declarations) {
                if (!isConceptDeclaration(declaration)) continue;
                const properties = declarationProperties(declaration.properties);
                const sourceId = properties.get("source_id");
                const documentVersionId = properties.get("document_version_id");
                if (!nonEmpty(documentVersionId)) continue;
                const compatibilitySourceId = properties.get("compatibility_source_id");
                if (nonEmpty(sourceId) && nonEmpty(compatibilitySourceId)) {
                  addObject({
                    id: sourceId,
                    kind: "compatibility_source_identity",
                    value: {
                      source_id: sourceId,
                      document_version_id: documentVersionId,
                      compatibility_source_id: compatibilitySourceId,
                    },
                    file: label,
                    corpus_id: ownerCorpus,
                    aliases: [],
                  });
                  continue;
                }
                if (!nonEmpty(sourceId) || documentVersions.has(sourceId)) {
                  loadIssues.push(
                    issue(
                      "integrity",
                      "INTEGRITY_CONTRACT_INVALID",
                      `Document-version identity ${declaration.name} must declare one unique source_id.`,
                      { corpus_id: ownerCorpus, file: label },
                    ),
                  );
                  continue;
                }
                documentVersions.set(sourceId, documentVersionId);
              }
              const declaredSourceIds = new Set<string>();
              for (let index = 0; index < parsed.model.declarations.length; index += 1) {
                const declaration = parsed.model.declarations[index];
                if (!isSource(declaration)) continue;
                const metadata = parsed.model.declarations[index + 1];
                if (!isConceptDeclaration(metadata)) {
                  loadIssues.push(
                    issue(
                      "integrity",
                      "INTEGRITY_CONTRACT_INVALID",
                      `Source ${declaration.name} is not followed by structured source metadata.`,
                      { corpus_id: ownerCorpus, file: label },
                    ),
                  );
                  continue;
                }
                const sourceProperties = declarationProperties(declaration.properties);
                const metadataProperties = declarationProperties(metadata.properties);
                const sourceId = metadataProperties.get("source_id");
                const documentHash = sourceProperties.get("SourceSha");
                const documentVersionId = nonEmpty(sourceId)
                  ? documentVersions.get(sourceId)
                  : undefined;
                if (!nonEmpty(sourceId) || !nonEmpty(documentHash) || !documentVersionId) {
                  loadIssues.push(
                    issue(
                      "integrity",
                      "INTEGRITY_CONTRACT_INVALID",
                      `Source ${declaration.name} must declare source_id, sha256, and one explicit document_version_id identity.`,
                      { corpus_id: ownerCorpus, file: label },
                    ),
                  );
                  continue;
                }
                declaredSourceIds.add(sourceId);
                const sourceVersion = metadataProperties.get("source_version");
                addObject({
                  id: sourceId,
                  kind: "source_document",
                  value: {
                    source_id: sourceId,
                    document_hash: documentHash,
                    uri: sourceProperties.get("SourceUri"),
                    media_type: sourceProperties.get("SourceMediaType"),
                    retrieved_at: sourceProperties.get("SourceRetrieved"),
                    source_title: metadataProperties.get("source_title"),
                    source_version: sourceVersion,
                    source_date: metadataProperties.get("source_date"),
                    document_version_id: documentVersionId,
                  },
                  file: label,
                  corpus_id: ownerCorpus,
                  aliases: [],
                });
              }
              for (const sourceId of documentVersions.keys()) {
                if (declaredSourceIds.has(sourceId)) continue;
                loadIssues.push(
                  issue(
                    "integrity",
                    "INTEGRITY_CONTRACT_INVALID",
                    `Document-version identity references missing source ${sourceId}.`,
                    { corpus_id: ownerCorpus, file: label },
                  ),
                );
              }
              continue;
            }
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
                const governingEntry = entries.find(
                  (candidate) => candidate.corpus_id === ownerCorpus,
                );
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
                const loaded: LoadedRecord = {
                  value: record,
                  file: label,
                  corpus_id: ownerCorpus,
                  governing_contract: {
                    ...governingContract,
                    adapter_kind: adapted.capabilities.adapterKind,
                    expected_family: adapted.capabilities.expectedFamily,
                    verifies_core_provenance: adapted.capabilities.verifiesCoreProvenance,
                  },
                  manifest_family: governingManifest.value.family,
                  catalog_family: governingEntry?.family ?? governingManifest.value.family,
                };
                records.push(loaded);
                if (
                  adapted.capabilities.adapterKind === "current_native_core" &&
                  governingContract.id === INSTITUTIONAL_RECORD_SCHEMA &&
                  record.schema_version === "0.2.0"
                )
                  institutionalRecords.push(loaded as LoadedRecord<AtomicInstitutionalRecord>);
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
          const documentAdapted = governingAdapter.adapt({
            family: governingManifest.value.family,
            value,
          });
          const documentEntry = entries.find((candidate) => candidate.corpus_id === ownerCorpus);
          documents.push({
            value,
            file: label,
            corpus_id: ownerCorpus,
            category,
            governing_contract: {
              ...governingContract,
              adapter_kind: documentAdapted.capabilities.adapterKind,
              expected_family: documentAdapted.capabilities.expectedFamily,
              verifies_core_provenance: documentAdapted.capabilities.verifiesCoreProvenance,
            },
            manifest_family: governingManifest.value.family,
            catalog_family: documentEntry?.family ?? governingManifest.value.family,
          });

          if (category === "sources" && Array.isArray(value.sources)) {
            for (const candidate of value.sources) {
              if (!object(candidate)) continue;
              const sourceObject = indexed(candidate, "source_document", label, ownerCorpus);
              if (sourceObject) addObject(sourceObject);
            }
          }

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

  const workflow = discoverWorkflowArtifacts(
    root,
    CURRENT_WORKFLOW_REGISTRATIONS,
    CURRENT_WORKFLOW_ADAPTERS,
  );
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
      sourceRoutes: [...sourceRouteMap.values()].sort((left, right) => {
        const leftKey = `${left.corpus_id}\0${left.file}`;
        const rightKey = `${right.corpus_id}\0${right.file}`;
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      }),
      workflowStates: workflow.workflowStates,
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
