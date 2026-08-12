import { compileSource } from "@writ/language";

import type {
  BundleEvidenceSource,
  BundleEvidenceSupport,
  BundleRecord,
  BundleRecordJudgment,
  BundleRecordLink,
  BundleSource,
} from "./contract.js";
import { extractWritDeclarations, extractYamlSequenceRecords } from "./exact-source.js";
import {
  asJsonObject,
  RECORD_JUDGMENT_CONTRACT,
  RECORD_LINK_CONTRACT,
  type Mapping,
  type NativeCorpus,
  type NativeRepository,
  object,
  parsedResource,
  rawHash,
  source,
  strings,
  text,
  validateAgainstContract,
} from "./repository.js";

const NULL_SOURCE: BundleEvidenceSource = {
  sourceId: null,
  documentVersionId: null,
  title: null,
  uri: null,
  publisher: null,
  issuedAt: null,
  retrievedAt: null,
  mediaType: null,
  sourceTier: null,
};

const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const optionalNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function yamlCollections(
  corpus: NativeCorpus,
  category: keyof NativeCorpus["resources"],
  key: string,
): Mapping[] {
  return corpus.resources[category].flatMap((path) => {
    if (!path.endsWith(".yaml") && !path.endsWith(".yml")) return [];
    const document = object(parsedResource(source(path)), path);
    const value = document[key];
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new TypeError(`${path}.${key} must be an array`);
    return value.map((item, index) => object(item, `${path}.${key}[${index}]`));
  });
}

function legalSource(value: Mapping): BundleEvidenceSource {
  return {
    sourceId: optionalText(value.machine_id),
    documentVersionId: optionalText(value.document_version_id),
    title: optionalText(value.title),
    uri: optionalText(value.uri),
    publisher: optionalText(value.publisher),
    issuedAt: optionalText(value.issued_at),
    retrievedAt: optionalText(value.retrieved_at),
    mediaType: optionalText(value.media_type),
    sourceTier: optionalNumber(value.source_tier),
  };
}

function projectCompatibilityEvidence(
  corpus: NativeCorpus,
  record: Mapping,
): BundleEvidenceSupport[] {
  if (record.record_type !== "political_claim") return [];
  const recordId = text(record.machine_id, "claim.machine_id");
  const relationships = yamlCollections(corpus, "relationships", "relationships");
  const passages = yamlCollections(corpus, "passages", "passages");
  const unresolved = yamlCollections(corpus, "passages", "unresolved");
  const sources = yamlCollections(corpus, "sources", "sources");
  const passagesById = new Map(
    passages.map((item) => [text(item.machine_id, "passage.machine_id"), item]),
  );
  const sourcesById = new Map(
    sources.map((item) => [text(item.machine_id, "source.machine_id"), item]),
  );
  const result: BundleEvidenceSupport[] = [];

  for (const relationship of relationships) {
    if (
      relationship.relationship_type !== "supported_by_passage" ||
      relationship.subject_machine_id !== recordId
    )
      continue;
    const supportId = text(relationship.machine_id, "relationship.machine_id");
    const passageId = text(relationship.object_machine_id, `${supportId}.object_machine_id`);
    const passage = passagesById.get(passageId);
    if (!passage) throw new Error(`${supportId} references missing passage ${passageId}`);
    const sourceId = text(passage.source_machine_id, `${passageId}.source_machine_id`);
    const sourceValue = sourcesById.get(sourceId);
    if (!sourceValue) throw new Error(`${passageId} references missing source ${sourceId}`);
    result.push({
      supportId,
      state: "traced",
      passageId,
      locator:
        optionalText(record.source_locator) ??
        optionalText(passage.page_number) ??
        optionalText(passage.dom_path),
      quote: text(passage.quote, `${passageId}.quote`),
      basis: "direct",
      passageHash: optionalText(passage.anchor_hash),
      documentHash: optionalText(sourceValue.sha256),
      reason: null,
      source: legalSource(sourceValue),
    });
  }

  const instrument = optionalText(record.instrument);
  for (const coverage of unresolved.filter(
    (item) => instrument !== null && item.instrument === instrument,
  )) {
    const supportId = text(coverage.machine_id, "unresolved.machine_id");
    const sourceId = text(coverage.source_machine_id, `${supportId}.source_machine_id`);
    const sourceValue = sourcesById.get(sourceId);
    if (!sourceValue) throw new Error(`${supportId} references missing source ${sourceId}`);
    result.push({
      supportId,
      state: "unresolved",
      passageId: null,
      locator: optionalText(coverage.source_locator) ?? optionalText(record.source_locator),
      quote: null,
      basis: null,
      passageHash: null,
      documentHash: null,
      reason: optionalText(coverage.reason) ?? "No source passage is registered for this record.",
      source: legalSource(sourceValue),
    });
  }
  if (result.length === 0) {
    result.push({
      supportId: `${recordId}:unresolved`,
      state: "unresolved",
      passageId: null,
      locator: optionalText(record.source_locator),
      quote: null,
      basis: null,
      passageHash: null,
      documentHash: null,
      reason: "No canonical passage or unresolved coverage record is registered.",
      source: NULL_SOURCE,
    });
  }
  return result;
}

function sourceForRecord(path: string, content: string): BundleSource {
  return {
    path,
    language: path.endsWith(".writ") ? "writ" : "yaml",
    sha256: rawHash(content),
    content,
  };
}

function projectCompatibilityRecords(corpus: NativeCorpus): BundleRecord[] {
  const records: BundleRecord[] = [];
  for (const path of corpus.resources.records) {
    if (!path.endsWith(".yaml") && !path.endsWith(".yml")) continue;
    const wholeSource = source(path);
    const document = object(parsedResource(wholeSource), path);
    validateAgainstContract(corpus.manifest.record_contract.id, document, path);
    for (const collectionKey of ["claims", "entities"]) {
      if (document[collectionKey] === undefined) continue;
      for (const exact of extractYamlSequenceRecords(
        wholeSource.content,
        collectionKey,
        "machine_id",
      )) {
        const recordId = text(exact.value.machine_id, `${path}.machine_id`);
        const declaredCorpus = optionalText(exact.value.corpus_id);
        if (declaredCorpus !== null && declaredCorpus !== corpus.entry.corpus_id) {
          throw new Error(`${path}: ${recordId} declares corpus ${declaredCorpus}`);
        }
        records.push({
          recordKey: `${corpus.entry.corpus_id}::${recordId}`,
          corpusId: corpus.entry.corpus_id,
          recordId,
          family: optionalText(exact.value.family) ?? corpus.entry.family,
          recordType: text(exact.value.record_type, `${path}.${recordId}.record_type`),
          reviewState:
            optionalText(exact.value.review_status) ?? optionalText(exact.value.review_state),
          aliases: strings(exact.value.aliases ?? [], `${path}.${recordId}.aliases`),
          legacyRefs: strings(exact.value.legacy_refs ?? [], `${path}.${recordId}.legacy_refs`),
          reference: optionalText(exact.value.ref),
          contract: corpus.manifest.record_contract,
          evidence: projectCompatibilityEvidence(corpus, exact.value),
          uncertainties: Array.isArray(exact.value.uncertainties) ? exact.value.uncertainties : [],
          storedSource: sourceForRecord(path, exact.source),
          storedRecord: asJsonObject(exact.value, `${path}.${recordId}`),
          compiledRecord: null,
        });
      }
    }
  }
  return records;
}

function sourceRegistry(repository: NativeRepository): ReadonlyMap<string, BundleEvidenceSource> {
  const result = new Map<string, BundleEvidenceSource>();
  for (const resource of repository.resources.values()) {
    if (resource.language !== "yaml") continue;
    const parsed = object(parsedResource(resource), resource.path);
    if (!Array.isArray(parsed.sources)) continue;
    for (const value of parsed.sources) {
      const mapping = object(value, `${resource.path}.sources`);
      const id = optionalText(mapping.machine_id);
      if (id) result.set(id, legalSource(mapping));
    }
  }
  return result;
}

function compiledEvidence(
  value: Mapping,
  registry: ReadonlyMap<string, BundleEvidenceSource>,
): BundleEvidenceSupport[] {
  if (!Array.isArray(value.evidence)) return [];
  return value.evidence.map((item, index) => {
    const support = object(item, `evidence[${index}]`);
    const sourceId = optionalText(support.source_id);
    return {
      supportId:
        optionalText(support.passage_id) ??
        `${text(value.record_id, "record_id")}:evidence:${index}`,
      state: "traced",
      passageId: optionalText(support.passage_id),
      locator: optionalText(support.locator),
      quote: optionalText(support.quote),
      basis: optionalText(support.basis),
      passageHash: optionalText(support.passage_hash),
      documentHash: optionalText(support.document_hash),
      reason: null,
      source: (sourceId ? registry.get(sourceId) : undefined) ?? { ...NULL_SOURCE, sourceId },
    };
  });
}

function compileClean(path: string, content: string) {
  const compiled = compileSource(content, { fileName: path });
  const errors = compiled.diagnostics.filter((item) => item.severity === "error");
  if (errors.length > 0 || !compiled.schemaValid) {
    throw new Error(
      `${path}: ${[...errors.map((item) => item.message), ...compiled.schemaErrors.map((item) => item.message)].join("; ")}`,
    );
  }
  return compiled;
}

function projectWritRecords(
  corpus: NativeCorpus,
  registry: ReadonlyMap<string, BundleEvidenceSource>,
): BundleRecord[] {
  const records: BundleRecord[] = [];
  for (const path of corpus.resources.records) {
    if (!path.endsWith(".writ")) continue;
    const whole = source(path);
    const exact = extractWritDeclarations(whole.content, path);
    const compiled = compileClean(path, whole.content);
    for (const recordValue of compiled.records) {
      const record = recordValue as unknown as Mapping;
      validateAgainstContract(
        corpus.manifest.record_contract.id,
        record,
        `${path}.${recordValue.record_id}`,
      );
      if (recordValue.corpus_id !== corpus.entry.corpus_id) {
        throw new Error(`${path}: ${recordValue.record_id} belongs to ${recordValue.corpus_id}`);
      }
      const exactSource = exact.records.get(recordValue.record_id);
      if (!exactSource) throw new Error(`${path}: missing CST source for ${recordValue.record_id}`);
      records.push({
        recordKey: `${corpus.entry.corpus_id}::${recordValue.record_id}`,
        corpusId: corpus.entry.corpus_id,
        recordId: recordValue.record_id,
        family: recordValue.family,
        recordType: recordValue.family,
        reviewState: optionalText(record.review_state),
        aliases: [],
        legacyRefs: [],
        reference: null,
        contract: corpus.manifest.record_contract,
        evidence: compiledEvidence(record, registry),
        uncertainties: Array.isArray(record.uncertainties) ? record.uncertainties : [],
        storedSource: sourceForRecord(path, exactSource),
        storedRecord: null,
        compiledRecord: asJsonObject(record, `${path}.${recordValue.record_id}`),
      });
    }
  }
  return records;
}

function projectRecordLinks(corpus: NativeCorpus): BundleRecordLink[] {
  const links: BundleRecordLink[] = [];
  if (corpus.manifest.record_contract.kind === "compatibility") return links;
  for (const path of corpus.resources.relationships) {
    if (!path.endsWith(".yaml") && !path.endsWith(".yml")) continue;
    const whole = source(path);
    const value = asJsonObject(parsedResource(whole), path);
    validateAgainstContract(RECORD_LINK_CONTRACT, value, path);
    const id = text(value.link_id, `${path}.link_id`);
    links.push({
      linkKey: `${corpus.entry.corpus_id}::${id}`,
      corpusId: corpus.entry.corpus_id,
      linkId: id,
      reviewState: text(value.review_state, `${path}.review_state`),
      contractId: RECORD_LINK_CONTRACT,
      storedSource: whole,
      value,
    });
  }
  return links;
}

function projectJudgments(corpus: NativeCorpus): BundleRecordJudgment[] {
  const judgments: BundleRecordJudgment[] = [];
  if (corpus.manifest.record_contract.kind === "compatibility") return judgments;
  for (const path of corpus.resources.judgments) {
    if (!path.endsWith(".writ")) continue;
    const whole = source(path);
    const exact = extractWritDeclarations(whole.content, path);
    const compiled = compileClean(path, whole.content);
    for (const value of compiled.judgments) {
      const judgment = value as unknown as Mapping;
      validateAgainstContract(RECORD_JUDGMENT_CONTRACT, judgment, `${path}.${value.judgment_id}`);
      const exactSource = exact.judgments.get(value.judgment_id);
      if (!exactSource) throw new Error(`${path}: missing CST source for ${value.judgment_id}`);
      judgments.push({
        judgmentKey: `${corpus.entry.corpus_id}::${value.judgment_id}`,
        corpusId: corpus.entry.corpus_id,
        judgmentId: value.judgment_id,
        targetKind: text(judgment.target_kind, `${value.judgment_id}.target_kind`),
        targetId: text(judgment.target_id, `${value.judgment_id}.target_id`),
        status: text(judgment.status, `${value.judgment_id}.status`),
        contractId: RECORD_JUDGMENT_CONTRACT,
        storedSource: sourceForRecord(path, exactSource),
        compiledJudgment: asJsonObject(judgment, `${path}.${value.judgment_id}`),
      });
    }
  }
  return judgments;
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

export function projectCanonicalObjects(repository: NativeRepository): {
  readonly records: readonly BundleRecord[];
  readonly recordLinks: readonly BundleRecordLink[];
  readonly recordJudgments: readonly BundleRecordJudgment[];
} {
  const registry = sourceRegistry(repository);
  const records = repository.corpora.flatMap((corpus) => {
    const extensions = new Set(
      corpus.resources.records.map((path) =>
        path.endsWith(".writ")
          ? "writ"
          : path.endsWith(".yaml") || path.endsWith(".yml")
            ? "yaml"
            : "unsupported",
      ),
    );
    if (extensions.has("unsupported") || extensions.size !== 1) {
      throw new Error(
        `${corpus.entry.corpus_id}: record locations must use one supported canonical representation`,
      );
    }
    const projected = extensions.has("writ")
      ? projectWritRecords(corpus, registry)
      : projectCompatibilityRecords(corpus);
    const counts = corpus.manifest.record_counts;
    const expected =
      Number(counts.claims ?? 0) +
      Number(counts.entities ?? 0) +
      Number(counts.legal_policy_records ?? 0) +
      Number(counts.institutional_records ?? 0);
    if (projected.length !== expected) {
      throw new Error(
        `${corpus.entry.corpus_id}: manifest declares ${expected} records, exported ${projected.length}`,
      );
    }
    return projected;
  });
  const recordLinks = repository.corpora.flatMap(projectRecordLinks);
  const recordJudgments = repository.corpora.flatMap(projectJudgments);
  for (const corpus of repository.corpora) {
    const expectedLinks = Number(corpus.manifest.record_counts.record_links ?? 0);
    const expectedJudgments = Number(corpus.manifest.record_counts.disposition_judgments ?? 0);
    const actualLinks = recordLinks.filter(
      (item) => item.corpusId === corpus.entry.corpus_id,
    ).length;
    const actualJudgments = recordJudgments.filter(
      (item) => item.corpusId === corpus.entry.corpus_id,
    ).length;
    if (actualLinks !== expectedLinks || actualJudgments !== expectedJudgments) {
      throw new Error(
        `${corpus.entry.corpus_id}: manifest link/judgment counts disagree with export`,
      );
    }
  }
  assertUnique(
    records.map((item) => item.recordKey),
    "record key",
  );
  assertUnique(
    recordLinks.map((item) => item.linkKey),
    "record-link key",
  );
  assertUnique(
    recordJudgments.map((item) => item.judgmentKey),
    "judgment key",
  );
  return { records, recordLinks, recordJudgments };
}
