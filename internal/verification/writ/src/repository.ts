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
  issue,
  type CatalogEntry,
  type CorpusCatalog,
  type CorpusManifest,
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
const REVIEWED_DOCUMENT_SCHEMA =
  "https://writ.example/schemas/compatibility/eu-us-ai-reviewed-v1/reviewed-corpus-document.schema.json";

const adapterKey = (id: string, version: string): string => `${id}::${version}`;
const SUPPORTED_RECORD_ADAPTERS = new Set([
  adapterKey("https://writ.example/schemas/extensions/institutional-record.schema.json", "0.2.0"),
  adapterKey("https://writ.example/schemas/extensions/legal-policy-record.schema.json", "0.2.0"),
  adapterKey(
    "https://writ.example/schemas/compatibility/record-grammar-v0.1/legal-policy-record.schema.json",
    "0.1.0",
  ),
  adapterKey(REVIEWED_DOCUMENT_SCHEMA, "1.0.0"),
]);

export type ContractSupport = "invalid" | "supported" | "unsupported";

export function classifyRecordContract(
  authority: AuthorityIndex,
  id: string,
  exactVersion: string,
): ContractSupport {
  if (!authority.schemas.has(id)) return "invalid";
  return SUPPORTED_RECORD_ADAPTERS.has(adapterKey(id, exactVersion)) ? "supported" : "unsupported";
}

const CATEGORIES: readonly ManifestCategory[] = [
  "sources",
  "passages",
  "records",
  "relationships",
  "judgments",
  "migration",
];

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
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
  category: ManifestCategory,
  location: string,
  issues: VerificationIssue[],
): string[] {
  const absolute = resolve(root, entry.path, location);
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
    typeof value.queue_id !== "string" ||
    typeof value.status !== "string" ||
    !Array.isArray(value.active_link_ids) ||
    !value.active_link_ids.every((item) => typeof item === "string") ||
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
  for (const candidate of value.mappings) {
    if (
      !object(candidate) ||
      typeof candidate.mapping_id !== "string" ||
      typeof candidate.mapping_status !== "string" ||
      !(
        typeof candidate.legal_policy_record_id === "string" ||
        candidate.legal_policy_record_id === null
      ) ||
      typeof candidate.proposed_relation !== "string" ||
      typeof candidate.target_institutional_id !== "string"
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
    mappings.push(candidate as unknown as MappingQueueEntry);
  }
  if (issues.length > 0) return { issues };
  return {
    queue: {
      schema_version: "1.0.0",
      queue_id: value.queue_id,
      status: value.status,
      active_link_ids: value.active_link_ids as string[],
      mappings,
      file: relative(root, file),
    },
    issues: [],
  };
}

function discoverQueues(root: string): { queues: MappingQueue[]; issues: VerificationIssue[] } {
  const migrationsRoot = join(root, "docs", "migrations");
  const queues: MappingQueue[] = [];
  const issues: VerificationIssue[] = [];
  for (const file of filesUnder(migrationsRoot).filter((path) =>
    path.endsWith("/mapping-queue.yaml"),
  )) {
    const parsed = parseMappingQueueFile(file, root);
    issues.push(...parsed.issues);
    if (parsed.queue) queues.push(parsed.queue);
  }
  return { queues, issues };
}

function migrationRenames(
  value: Record<string, unknown>,
  file: string,
  corpusId: string,
): MigrationRename[] {
  const result: MigrationRename[] = [];
  for (const candidate of Array.isArray(value.post_review_id_renames)
    ? value.post_review_id_renames
    : []) {
    if (
      !object(candidate) ||
      typeof candidate.previous_approved_id !== "string" ||
      typeof candidate.active_id !== "string"
    )
      continue;
    result.push({
      previous_id: candidate.previous_approved_id,
      active_id: candidate.active_id,
      ...(typeof candidate.review_artifact === "string"
        ? { review_artifact: candidate.review_artifact }
        : {}),
      file,
      corpus_id: corpusId,
    });
  }
  for (const candidate of Array.isArray(value.approved_id_renames)
    ? value.approved_id_renames
    : []) {
    if (
      !object(candidate) ||
      typeof candidate.previous_draft_id !== "string" ||
      typeof candidate.approved_id !== "string"
    )
      continue;
    result.push({
      previous_id: candidate.previous_draft_id,
      active_id: candidate.approved_id,
      file,
      corpus_id: corpusId,
    });
  }
  return result;
}

export interface LoadRepositoryResult {
  snapshot: RepositorySnapshot;
  authority: AuthorityIndex;
}

export function loadRepository(root: string): LoadRepositoryResult {
  const authority = loadAuthorityIndex(root);
  const loadIssues: VerificationIssue[] = [...authority.issues];
  const catalogFile = join(root, "corpora", "catalog.yaml");
  const catalogValue = parseStructured(catalogFile);
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
  const catalog = catalogValue as CorpusCatalog;
  const entries = Array.isArray(catalog.native_corpora) ? catalog.native_corpora : [];
  const manifests: Loaded<CorpusManifest>[] = [];
  for (const entry of entries) {
    const file = join(root, entry.manifest);
    if (!existsSync(file)) {
      loadIssues.push(
        issue("integrity", "INTEGRITY_ROUTED_FILE_MISSING", "Catalogued manifest does not exist.", {
          corpus_id: entry.corpus_id,
          file: entry.manifest,
        }),
      );
      continue;
    }
    const value = parseStructured(file);
    loadIssues.push(
      ...validateDocument(
        authority,
        MANIFEST_SCHEMA,
        value,
        "INTEGRITY_MANIFEST_INVALID",
        file,
        root,
        entry.corpus_id,
      ),
    );
    manifests.push({
      value: value as CorpusManifest,
      file: entry.manifest,
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
        for (const absolute of expandLocation(root, entry, category, location, loadIssues)) {
          const label = relative(root, absolute);
          // A physical compatibility document may be listed by its owning corpus and
          // by an institutional consumer. Load it once per category under its real owner.
          const routeKey = `${realpathSync(absolute)}\0${category}`;
          if (routed.has(routeKey)) continue;
          routed.add(routeKey);
          const ownerCorpus = ownerForFile(root, entries, absolute) ?? manifest.corpus_id;

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
                  { corpus_id: manifest.corpus_id, file: label },
                ),
              );
              continue;
            }
            if (category === "records") {
              for (const record of compiled.records) {
                loadIssues.push(
                  ...validateDocument(
                    authority,
                    contract.id,
                    record,
                    "INTEGRITY_CONTRACT_INVALID",
                    absolute,
                    root,
                    manifest.corpus_id,
                  ),
                );
                const loaded = { value: record, file: label, corpus_id: manifest.corpus_id };
                records.push(loaded);
                if (record.family === "institutional" && record.schema_version === "0.2.0")
                  institutionalRecords.push(loaded as Loaded<AtomicInstitutionalRecord>);
                const recordObject = indexed(
                  record as unknown as Record<string, unknown>,
                  "record",
                  label,
                  manifest.corpus_id,
                );
                if (recordObject) addObject(recordObject);
                for (const evidence of record.evidence) {
                  addObject({
                    id: evidence.passage_id,
                    kind: "passage",
                    value: evidence as unknown as Record<string, unknown>,
                    file: label,
                    corpus_id: manifest.corpus_id,
                    aliases: [],
                  });
                  addObject({
                    id: evidence.source_id,
                    kind: "source",
                    value: evidence as unknown as Record<string, unknown>,
                    file: label,
                    corpus_id: manifest.corpus_id,
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
                    manifest.corpus_id,
                  ),
                );
                judgments.push({
                  value: judgment as CurrentRecordJudgment,
                  file: label,
                  corpus_id: manifest.corpus_id,
                });
                const judgmentObject = indexed(
                  judgment as unknown as Record<string, unknown>,
                  "judgment",
                  label,
                  manifest.corpus_id,
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
                { corpus_id: manifest.corpus_id, file: label },
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
                { corpus_id: manifest.corpus_id, file: label },
              ),
            );
            continue;
          }
          documents.push({ value, file: label, corpus_id: ownerCorpus, category });

          if (contract.id === REVIEWED_DOCUMENT_SCHEMA) {
            loadIssues.push(
              ...validateDocument(
                authority,
                contract.id,
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
                        ? "source"
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
                manifest.corpus_id,
              ),
            );
            links.push({
              value: value as unknown as RecordLink,
              file: label,
              corpus_id: manifest.corpus_id,
            });
            const linkObject = indexed(
              { ...value, record_id: value.link_id },
              "record_link",
              label,
              manifest.corpus_id,
            );
            if (linkObject) addObject(linkObject);
          } else if (category === "migration") {
            if (typeof value.schema_version === "string" && value.schema_version !== "1.0.0") {
              loadIssues.push(
                issue(
                  "integrity",
                  "VERIFIER_UNSUPPORTED_CONTRACT",
                  `I recognize the migration workflow identity, but I do not have verified support for declared version ${value.schema_version}.`,
                  { corpus_id: manifest.corpus_id, file: label },
                ),
              );
            } else {
              migrations.push(...migrationRenames(value, label, manifest.corpus_id));
            }
          }
        }
      }
    }
  }

  const discoveredQueues = discoverQueues(root);
  loadIssues.push(...discoveredQueues.issues);
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
      queues: discoveredQueues.queues,
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
