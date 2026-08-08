/**
 * Build the Corpus product projection directly from canonical native corpora.
 *
 * The compact index is safe to ship to the browser. Full quotations, source
 * representations, hashes and compiler output remain in the server-only detail
 * projection and are returned one record at a time.
 */
import { writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileSource,
  isConceptDeclaration,
  isRecordDeclaration,
  isSource,
  parseDocument as parseWritDocument,
  spanOf,
} from "@writ/language";
import type { AtomicInstitutionalRecord, WritRecord } from "@writ/domain";
import { isMap, isSeq, parseDocument as parseYamlDocument } from "yaml";

import { LAB_RECORDS } from "../lib/lab-record-presentation";
import type {
  CorpusEvidenceSource,
  CorpusEvidenceSupport,
  CorpusRecordDetail,
  CorpusRecordIndex,
  CorpusTraceState,
} from "../lib/corpus-record-types";
import {
  type Mapping,
  type NativeCorpus,
  object,
  readCorpusFile,
  readNativeCorpora,
  repoRoot,
  stringList,
  text,
} from "./lib/read-native-corpora";

const here = dirname(fileURLToPath(import.meta.url));
const indexOutFile = join(here, "..", "lib", "corpus-record-index-data.ts");
const detailOutFile = join(here, "..", "lib", "corpus-record-detail-data.ts");
const curatedLabIds = new Set(LAB_RECORDS.map((record) => record.id));

interface ExactYamlRecord {
  readonly value: Mapping;
  readonly source: string;
}

interface SourceRegistryEntry extends CorpusEvidenceSource {
  readonly documentHash: string | null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSearch(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .normalize("NFKD")
    .toLocaleLowerCase("en");
}

export function deriveCorpusTraceState(
  evidence: readonly CorpusEvidenceSupport[],
): CorpusTraceState {
  const traced = evidence.filter((support) => support.state === "traced").length;
  if (traced === evidence.length && evidence.length > 0) return "fully_traced";
  if (traced > 0) return "partially_traced";
  return "untraced";
}

function corpusTitle(corpus: NativeCorpus): string {
  return corpus.manifest.title.replace(/ institutional facts$/, "");
}

function exactLabId(legacyIds: readonly string[]): string | null {
  return legacyIds.find((id) => curatedLabIds.has(id)) ?? null;
}

/** Exact YAML sequence entries, including their original list marker and indentation. */
export function extractYamlSequenceRecords(
  sourceText: string,
  collectionKey: string,
  identityKey: string,
): readonly ExactYamlRecord[] {
  const document = parseYamlDocument(sourceText, { keepSourceTokens: true, strict: true });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("\n"));
  }
  const collection = document.get(collectionKey, true);
  if (!isSeq(collection)) throw new TypeError(`${collectionKey} must be a YAML sequence`);

  return collection.items.map((node, index) => {
    if (!node || !isMap(node) || !node.range) {
      throw new TypeError(`${collectionKey}[${index}] must be a ranged YAML map`);
    }
    const value = object(node.toJSON(), `${collectionKey}[${index}]`);
    const identity = text(value[identityKey], `${collectionKey}[${index}].${identityKey}`);
    const lineStart = sourceText.lastIndexOf("\n", node.range[0] - 1) + 1;
    const exactSource = sourceText.slice(lineStart, node.range[2]);

    const reparsed = parseYamlDocument(exactSource, { strict: true });
    const reparsedValue = reparsed.toJS();
    if (
      reparsed.errors.length > 0 ||
      !Array.isArray(reparsedValue) ||
      !reparsedValue[0] ||
      reparsedValue[0][identityKey] !== identity
    ) {
      throw new Error(`Exact YAML extraction failed for ${collectionKey}.${identity}`);
    }
    return { value, source: exactSource };
  });
}

/** Exact Writ record declarations, sliced from Langium's CST offsets. */
export function extractWritRecordSources(
  sourceText: string,
  fileName: string,
): ReadonlyMap<string, string> {
  const parsed = parseWritDocument(sourceText, { fileName });
  if (!parsed.ok) {
    throw new Error(`${fileName}: ${parsed.diagnostics.map((item) => item.message).join("; ")}`);
  }
  const records = new Map<string, string>();
  for (const declaration of parsed.model.declarations) {
    if (!isRecordDeclaration(declaration)) continue;
    const span = spanOf(declaration);
    if (!span) throw new Error(`${fileName}: record ${declaration.name} has no source span`);
    const exactSource = sourceText.slice(span.offset, span.offset + span.length);
    const verification = parseWritDocument(
      `language writ "0.2"\npackage corpus.extraction.verify version "0.2.0";\n\n${exactSource}`,
      { fileName: `${fileName}#${declaration.name}` },
    );
    const identity = verification.model.declarations.find(isRecordDeclaration)?.name;
    if (!verification.ok || identity !== declaration.name) {
      throw new Error(`${fileName}: exact Writ extraction failed for ${declaration.name}`);
    }
    records.set(declaration.name, exactSource);
  }
  return records;
}

function locationFiles(corpus: NativeCorpus, kind: string, extension: string): string[] {
  const locations = stringList(
    corpus.manifest.locations[kind],
    `${corpus.entry.manifest}.locations.${kind}`,
  );
  return locations.filter((path) => extname(path) === extension);
}

function yamlCollection(corpus: NativeCorpus, path: string, key: string): Mapping[] {
  const parsed = object(Bun.YAML.parse(readCorpusFile(corpus, path)), path);
  const value = parsed[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${path}.${key} must be an array`);
  return value.map((item, index) => object(item, `${path}.${key}[${index}]`));
}

function sourceFromLegalRecord(source: Mapping): SourceRegistryEntry {
  return {
    sourceId: optionalText(source.machine_id),
    title: optionalText(source.title) ?? optionalText(source.display_ref),
    uri: optionalText(source.uri),
    publisher: optionalText(source.publisher),
    issuedAt: optionalText(source.issued_at),
    retrievedAt: optionalText(source.retrieved_at),
    mediaType: optionalText(source.media_type),
    sourceTier: optionalNumber(source.source_tier),
    documentHash: optionalText(source.sha256),
  };
}

function plainProperties(
  properties: readonly {
    readonly $type: string;
    readonly value?: unknown;
    readonly name?: string;
  }[],
): ReadonlyMap<string, unknown> {
  return new Map(
    properties.map((property) => [property.name ?? property.$type, property.value] as const),
  );
}

function sourceRegistryForInstitutional(corpus: NativeCorpus): {
  readonly byId: ReadonlyMap<string, SourceRegistryEntry>;
  readonly byHash: ReadonlyMap<string, SourceRegistryEntry>;
} {
  const byId = new Map<string, SourceRegistryEntry>();
  const byHash = new Map<string, SourceRegistryEntry>();

  for (const path of locationFiles(corpus, "sources", ".writ")) {
    const sourceText = readCorpusFile(corpus, path);
    const parsed = parseWritDocument(sourceText, { fileName: path });
    if (!parsed.ok) throw new Error(`${path}: source module did not parse`);

    for (let index = 0; index < parsed.model.declarations.length; index += 1) {
      const declaration = parsed.model.declarations[index];
      if (!isSource(declaration)) continue;
      const concept = parsed.model.declarations[index + 1];
      if (!isConceptDeclaration(concept)) {
        throw new Error(`${path}: source ${declaration.name} is not followed by source metadata`);
      }
      const sourceProperties = plainProperties(declaration.properties);
      const conceptProperties = plainProperties(concept.properties);
      const sourceId = text(
        conceptProperties.get("source_id"),
        `${path}.${concept.name}.source_id`,
      );
      const entry: SourceRegistryEntry = {
        sourceId,
        title: optionalText(conceptProperties.get("source_title")),
        uri: optionalText(sourceProperties.get("SourceUri")),
        publisher: null,
        issuedAt: optionalText(conceptProperties.get("source_date")),
        retrievedAt: optionalText(sourceProperties.get("SourceRetrieved")),
        mediaType: optionalText(sourceProperties.get("SourceMediaType")),
        sourceTier: null,
        documentHash: optionalText(sourceProperties.get("SourceSha")),
      };
      byId.set(sourceId, entry);
      if (entry.documentHash) byHash.set(entry.documentHash, entry);
    }
  }

  for (const path of locationFiles(corpus, "sources", ".yaml")) {
    for (const source of yamlCollection(corpus, path, "sources")) {
      const entry = sourceFromLegalRecord(source);
      if (entry.sourceId) byId.set(entry.sourceId, entry);
      if (entry.documentHash) byHash.set(entry.documentHash, entry);
    }
  }
  return { byId, byHash };
}

export function unresolvedLegalSupports(
  corpus: NativeCorpus,
  claim: Mapping,
  sources: readonly Mapping[],
  unresolved: readonly Mapping[],
): readonly CorpusEvidenceSupport[] {
  const instrument = optionalText(claim.instrument);
  const relevant = unresolved.filter(
    (coverage) => instrument !== null && optionalText(coverage.instrument) === instrument,
  );
  return relevant.map((coverage) => {
    const coverageId = text(coverage.machine_id, "unresolved.machine_id");
    const sourceId = text(coverage.source_machine_id, `unresolved ${coverageId}.source_machine_id`);
    const source = sources.find((item) => item.machine_id === sourceId);
    if (!source)
      throw new Error(`Unresolved coverage ${coverageId} references missing source ${sourceId}`);
    return {
      supportId: coverageId,
      state: "unresolved",
      passageId: null,
      locator: optionalText(coverage.source_locator) ?? optionalText(claim.source_locator),
      quote: null,
      basis: null,
      passageHash: null,
      documentHash: null,
      reason:
        optionalText(coverage.reason) ??
        optionalText(source.reason) ??
        "No source passage is registered for this record.",
      source: {
        sourceId,
        title: optionalText(source.display_ref) ?? corpusTitle(corpus),
        uri: null,
        publisher: null,
        issuedAt: null,
        retrievedAt: null,
        mediaType: null,
        sourceTier: null,
      },
    };
  });
}

export function validateLegalRelationships(
  relationships: readonly Mapping[],
  claimIds: ReadonlySet<string>,
  passageIds: ReadonlySet<string>,
): void {
  const relationshipIds = new Set<string>();
  for (const relationship of relationships) {
    const relationshipId = text(relationship.machine_id, "relationship.machine_id");
    if (relationshipIds.has(relationshipId)) {
      throw new Error(`Duplicate relationship id: ${relationshipId}`);
    }
    relationshipIds.add(relationshipId);
    const relationshipType = text(
      relationship.relationship_type,
      `relationship ${relationshipId}.relationship_type`,
    );
    const subjectId = text(
      relationship.subject_machine_id,
      `relationship ${relationshipId}.subject_machine_id`,
    );
    const subjectType = text(
      relationship.subject_type,
      `relationship ${relationshipId}.subject_type`,
    );
    const objectId = text(
      relationship.object_machine_id,
      `relationship ${relationshipId}.object_machine_id`,
    );
    const objectType = text(relationship.object_type, `relationship ${relationshipId}.object_type`);
    if (subjectType === "claim" && !claimIds.has(subjectId)) {
      throw new Error(`Relationship ${relationshipId} references missing claim ${subjectId}`);
    }
    if (relationshipType === "supported_by_passage") {
      if (subjectType !== "claim" || objectType !== "passage") {
        throw new Error(`Relationship ${relationshipId} has malformed evidence endpoint types`);
      }
      if (!passageIds.has(objectId)) {
        throw new Error(`Relationship ${relationshipId} references missing passage ${objectId}`);
      }
    }
  }
}

function legalProjection(corpus: NativeCorpus): {
  readonly index: CorpusRecordIndex[];
  readonly details: CorpusRecordDetail[];
} {
  const claimFiles = locationFiles(corpus, "records", ".yaml").filter((path) =>
    path.endsWith("claims.yaml"),
  );
  const claimEntries = claimFiles.flatMap((path) => {
    const sourceText = readCorpusFile(corpus, path);
    return extractYamlSequenceRecords(sourceText, "claims", "machine_id").map((entry) => ({
      ...entry,
      path,
    }));
  });
  const relationships = locationFiles(corpus, "relationships", ".yaml").flatMap((path) =>
    yamlCollection(corpus, path, "relationships"),
  );
  const passages = locationFiles(corpus, "passages", ".yaml").flatMap((path) =>
    yamlCollection(corpus, path, "passages"),
  );
  const unresolved = locationFiles(corpus, "passages", ".yaml").flatMap((path) =>
    yamlCollection(corpus, path, "unresolved"),
  );
  const sources = locationFiles(corpus, "sources", ".yaml").flatMap((path) =>
    yamlCollection(corpus, path, "sources"),
  );
  const passagesById = new Map(
    passages.map((passage) => [text(passage.machine_id, "passage.machine_id"), passage]),
  );
  const sourcesById = new Map(
    sources.map((source) => [text(source.machine_id, "source.machine_id"), source]),
  );
  const claimIds = new Set(
    claimEntries.map((entry) => text(entry.value.machine_id, "claim.machine_id")),
  );
  validateLegalRelationships(relationships, claimIds, new Set(passagesById.keys()));

  const index: CorpusRecordIndex[] = [];
  const details: CorpusRecordDetail[] = [];
  for (const [recordIndex, entry] of claimEntries.entries()) {
    const claim = entry.value;
    if (claim.review_status !== "accepted") continue;
    const recordId = text(claim.machine_id, "claim.machine_id");
    if (claim.corpus_id !== corpus.entry.corpus_id) {
      throw new Error(`${entry.path}: claim ${recordId} belongs to ${String(claim.corpus_id)}`);
    }
    const evidenceRelationships = relationships.filter(
      (relationship) =>
        relationship.relationship_type === "supported_by_passage" &&
        relationship.subject_machine_id === recordId,
    );
    const evidence: CorpusEvidenceSupport[] = evidenceRelationships.map((relationship) => {
      const passageId = text(relationship.object_machine_id, "relationship.object_machine_id");
      const passage = passagesById.get(passageId);
      if (!passage) throw new Error(`${entry.path}: passage ${passageId} does not resolve`);
      const sourceId = text(passage.source_machine_id, `passage ${passageId}.source_machine_id`);
      const source = sourcesById.get(sourceId);
      if (!source) throw new Error(`${entry.path}: source ${sourceId} does not resolve`);
      const sourceView = sourceFromLegalRecord(source);
      return {
        supportId: text(relationship.machine_id, "relationship.machine_id"),
        state: "traced",
        passageId,
        locator:
          optionalText(claim.source_locator) ??
          optionalText(passage.page_number) ??
          optionalText(passage.dom_path),
        quote: text(passage.quote, `passage ${passageId}.quote`),
        basis: "direct",
        passageHash: optionalText(passage.anchor_hash),
        documentHash: sourceView.documentHash,
        reason: null,
        source: sourceView,
      };
    });
    evidence.push(...unresolvedLegalSupports(corpus, claim, sources, unresolved));
    if (evidence.length === 0) {
      evidence.push({
        supportId: `${recordId}:unresolved`,
        state: "unresolved",
        passageId: null,
        locator: optionalText(claim.source_locator),
        quote: null,
        basis: null,
        passageHash: null,
        documentHash: null,
        reason: "No canonical passage or unresolved coverage record is registered.",
        source: {
          sourceId: null,
          title: corpusTitle(corpus),
          uri: null,
          publisher: null,
          issuedAt: null,
          retrievedAt: null,
          mediaType: null,
          sourceTier: null,
        },
      });
    }

    const legacyIds = stringList(claim.legacy_refs ?? [], `claim ${recordId}.legacy_refs`);
    const titleValue = text(claim.display_ref, `claim ${recordId}.display_ref`);
    const interpretation = text(
      claim.interpretation_note,
      `claim ${recordId}.interpretation_note`,
    ).trim();
    const record: CorpusRecordIndex = {
      recordKey: `${corpus.entry.corpus_id}::${recordId}`,
      recordId,
      displayId: legacyIds[0] ?? recordId,
      legacyIds,
      corpusId: corpus.entry.corpus_id,
      corpusTitle: corpusTitle(corpus),
      corpusStatus: corpus.entry.status,
      corpusIndex: corpus.catalogIndex,
      recordIndex,
      family: "legal_policy",
      jurisdiction: corpus.entry.jurisdiction as "EU" | "US",
      reviewState: "accepted",
      title: titleValue,
      summary: interpretation,
      sourceLabel: evidence[0]?.source.title ?? corpusTitle(corpus),
      locator: optionalText(claim.source_locator),
      traceState: deriveCorpusTraceState(evidence),
      searchableText: normalizeSearch([
        recordId,
        ...legacyIds,
        titleValue,
        interpretation,
        optionalText(claim.instrument),
        optionalText(claim.source_locator),
        evidence[0]?.source.title,
      ]),
      labRecordId: exactLabId(legacyIds),
      legalForce: text(claim.legal_force, `claim ${recordId}.legal_force`),
      adoption: text(claim.adoption_status, `claim ${recordId}.adoption_status`),
      applicability: text(claim.applicability_status, `claim ${recordId}.applicability_status`),
      enforcement: text(claim.enforcement_status, `claim ${recordId}.enforcement_status`),
    };
    index.push(record);
    details.push({
      index: record,
      interpretation,
      assertion: null,
      evidence,
      uncertainties: [],
      recordedFields: {
        claim_record_type: claim.claim_record_type,
        legal_force: claim.legal_force,
        adoption_status: claim.adoption_status,
        applicability_status: claim.applicability_status,
        enforcement_status: claim.enforcement_status,
        actor_type: claim.actor_type ?? claim.current_actor_type ?? null,
        conduct_type: claim.conduct_type ?? null,
      },
      storedSource: {
        label: "Stored YAML",
        language: "yaml",
        path: join(corpus.entry.path, entry.path),
        content: entry.source,
      },
      compiledOutput: null,
      technical: {
        corpusId: corpus.entry.corpus_id,
        recordId,
        displayId: record.displayId,
        legacyIds,
        reviewState: "accepted",
        corpusStatus: corpus.entry.status,
        sourcePath: join(corpus.entry.path, entry.path),
      },
    });
  }
  return { index, details };
}

function familyRecordedFields(record: WritRecord): Readonly<Record<string, unknown>> {
  if (record.family !== "institutional") return {};
  const mapping = record as unknown as Mapping;
  const common = new Set([
    "schema_version",
    "record_id",
    "corpus_id",
    "record_version",
    "family",
    "title",
    "subjects",
    "assertion",
    "topics",
    "scope",
    "evidence",
    "uncertainties",
    "provenance",
    "review_state",
  ]);
  return Object.fromEntries(Object.entries(mapping).filter(([key]) => !common.has(key)));
}

function institutionalProjection(corpus: NativeCorpus): {
  readonly index: CorpusRecordIndex[];
  readonly details: CorpusRecordDetail[];
} {
  const registry = sourceRegistryForInstitutional(corpus);
  const index: CorpusRecordIndex[] = [];
  const details: CorpusRecordDetail[] = [];

  for (const path of locationFiles(corpus, "records", ".writ")) {
    const sourceText = readCorpusFile(corpus, path);
    const exactSources = extractWritRecordSources(sourceText, path);
    const compiled = compileSource(sourceText, { fileName: path });
    if (compiled.diagnostics.length > 0 || !compiled.schemaValid) {
      throw new Error(`${path}: institutional records did not compile and validate cleanly`);
    }
    for (const [recordIndex, compiledRecord] of compiled.records.entries()) {
      if (compiledRecord.family !== "institutional") continue;
      if (compiledRecord.review_state !== "approved") continue;
      const institutionalRecord = compiledRecord as AtomicInstitutionalRecord;
      const recordId = institutionalRecord.record_id;
      if (compiledRecord.corpus_id !== corpus.entry.corpus_id) {
        throw new Error(`${path}: record ${recordId} belongs to ${compiledRecord.corpus_id}`);
      }
      const exactSource = exactSources.get(recordId);
      if (!exactSource) throw new Error(`${path}: no exact source for record ${recordId}`);
      const evidence: CorpusEvidenceSupport[] = compiledRecord.evidence.map((support) => {
        const registrySource =
          registry.byId.get(support.source_id) ?? registry.byHash.get(support.document_hash);
        return {
          supportId: support.passage_id,
          state: "traced",
          passageId: support.passage_id,
          locator: support.locator,
          quote: support.quote,
          basis: support.basis,
          passageHash: support.passage_hash,
          documentHash: support.document_hash,
          reason: null,
          source: registrySource ?? {
            sourceId: support.source_id,
            title: support.source_id,
            uri: null,
            publisher: null,
            issuedAt: null,
            retrievedAt: null,
            mediaType: null,
            sourceTier: null,
          },
        };
      });
      const assertion = compiledRecord.assertion.text;
      const factType = institutionalRecord.institutional_fact_type;
      const firstEvidence = evidence[0];
      const record: CorpusRecordIndex = {
        recordKey: `${corpus.entry.corpus_id}::${recordId}`,
        recordId,
        displayId: recordId,
        legacyIds: [],
        corpusId: corpus.entry.corpus_id,
        corpusTitle: corpusTitle(corpus),
        corpusStatus: corpus.entry.status,
        corpusIndex: corpus.catalogIndex,
        recordIndex,
        family: "institutional",
        jurisdiction: corpus.entry.jurisdiction as "EU" | "US",
        reviewState: "approved",
        title: compiledRecord.title,
        summary: assertion,
        sourceLabel: firstEvidence?.source.title ?? null,
        locator: firstEvidence?.locator ?? null,
        traceState: deriveCorpusTraceState(evidence),
        searchableText: normalizeSearch([
          recordId,
          compiledRecord.title,
          assertion,
          firstEvidence?.source.title,
          firstEvidence?.locator,
          factType,
        ]),
        labRecordId: null,
        factType,
      };
      index.push(record);
      details.push({
        index: record,
        interpretation: null,
        assertion,
        evidence,
        uncertainties: compiledRecord.uncertainties.map((uncertainty) => ({
          type: uncertainty.type,
          description: uncertainty.description,
        })),
        recordedFields: familyRecordedFields(compiledRecord),
        storedSource: {
          label: "Canonical .writ source",
          language: "writ",
          path: join(corpus.entry.path, path),
          content: exactSource,
        },
        compiledOutput: compiledRecord as unknown as Readonly<Record<string, unknown>>,
        technical: {
          corpusId: corpus.entry.corpus_id,
          recordId,
          displayId: recordId,
          legacyIds: [],
          reviewState: "approved",
          corpusStatus: corpus.entry.status,
          sourcePath: join(corpus.entry.path, path),
        },
      });
    }
  }
  return { index, details };
}

export function projectCorpusRecords(): {
  readonly index: readonly CorpusRecordIndex[];
  readonly details: Readonly<Record<string, CorpusRecordDetail>>;
} {
  const allIndex: CorpusRecordIndex[] = [];
  const allDetails: CorpusRecordDetail[] = [];
  for (const corpus of readNativeCorpora()) {
    const acceptedCount = Number(corpus.manifest.review_counts.accepted_claims ?? 0);
    const approvedCount = Number(corpus.manifest.review_counts.approved_records ?? 0);
    if (corpus.entry.family === "legal_policy") {
      const projected = legalProjection(corpus);
      if (projected.index.length !== acceptedCount) {
        throw new Error(`${corpus.entry.corpus_id}: expected ${acceptedCount} accepted records`);
      }
      allIndex.push(...projected.index);
      allDetails.push(...projected.details);
    }
    if (corpus.entry.family === "institutional") {
      const projected = institutionalProjection(corpus);
      if (projected.index.length !== approvedCount) {
        throw new Error(`${corpus.entry.corpus_id}: expected ${approvedCount} approved records`);
      }
      allIndex.push(...projected.index);
      allDetails.push(...projected.details);
    }
  }

  const keys = new Set<string>();
  for (const record of allIndex) {
    if (keys.has(record.recordKey))
      throw new Error(`Duplicate Corpus record key: ${record.recordKey}`);
    keys.add(record.recordKey);
  }
  const detailByKey = Object.fromEntries(
    allDetails.map((detail) => [detail.index.recordKey, detail]),
  );
  if (Object.keys(detailByKey).length !== allIndex.length) {
    throw new Error("Corpus index/detail projections disagree");
  }
  return { index: allIndex, details: detailByKey };
}

export function writeCorpusRecordProjection(): void {
  const projection = projectCorpusRecords();
  const indexBody = `// AUTO-GENERATED by apps/web/scripts/embed-corpus-records.ts — do not edit.\n\nimport type { CorpusRecordIndex } from "./corpus-record-types";\n\n// prettier-ignore\nexport const CORPUS_RECORD_INDEX: readonly CorpusRecordIndex[] = Object.freeze(${JSON.stringify(projection.index, null, 2)});\n`;
  const detailBody = `// AUTO-GENERATED by apps/web/scripts/embed-corpus-records.ts — do not edit.\n\nimport "server-only";\nimport type { CorpusRecordDetail } from "./corpus-record-types";\n\n// prettier-ignore\nexport const CORPUS_RECORD_DETAIL_BY_KEY: Readonly<Record<string, CorpusRecordDetail>> = Object.freeze(${JSON.stringify(projection.details, null, 2)});\n`;
  writeFileSync(indexOutFile, indexBody);
  writeFileSync(detailOutFile, detailBody);
  console.log(
    `embed-corpus-records: wrote ${relative(repoRoot, indexOutFile)} and ${relative(repoRoot, detailOutFile)} (${projection.index.length} records)`,
  );
}

if (import.meta.main) writeCorpusRecordProjection();
