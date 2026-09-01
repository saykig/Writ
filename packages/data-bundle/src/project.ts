import {
  compileSource,
  isConceptDeclaration,
  isSource,
  parseDocument as parseWritDocument,
} from "@writ/language";

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
  assertSupportedRecordContract,
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

const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const optionalNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

interface SourceRegistryEntry extends BundleEvidenceSource {
  readonly documentHash: string | null;
  readonly documentVersionIds: readonly string[];
}

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

function uniqueCompatibilityIdentities(
  values: readonly Mapping[],
  kind: "source" | "passage",
  includeAlternateIdentities: boolean,
): ReadonlyMap<string, Mapping> {
  const claims = new Map<string, number>();
  const canonical = new Map<string, Mapping>();
  for (const [index, value] of values.entries()) {
    const id = text(value.machine_id, `${kind}[${index}].machine_id`);
    const identities = new Set([
      id,
      ...(includeAlternateIdentities
        ? [
            ...strings(value.aliases ?? [], `${kind}[${index}].aliases`),
            ...strings(value.legacy_refs ?? [], `${kind}[${index}].legacy_refs`),
            ...(typeof value.ref === "string" ? [value.ref] : []),
          ]
        : []),
    ]);
    for (const identity of identities) {
      const previous = claims.get(identity);
      if (previous !== undefined && previous !== index) {
        throw new Error(
          `duplicate ${kind} identity ${identity} at ${kind}[${index}] (already claimed at ${kind}[${previous}])`,
        );
      }
      claims.set(identity, index);
    }
    canonical.set(id, value);
  }
  return canonical;
}

function assertCompatibilityEvidenceIdentities(corpus: NativeCorpus): void {
  uniqueCompatibilityIdentities(yamlCollections(corpus, "sources", "sources"), "source", true);
  uniqueCompatibilityIdentities(yamlCollections(corpus, "passages", "passages"), "passage", false);
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

export function projectCompatibilityEvidence(
  corpus: NativeCorpus,
  record: Mapping,
): BundleEvidenceSupport[] {
  if (record.record_type !== "political_claim") return [];
  const recordId = text(record.machine_id, "claim.machine_id");
  const relationships = yamlCollections(corpus, "relationships", "relationships");
  const passages = yamlCollections(corpus, "passages", "passages");
  const unresolved = yamlCollections(corpus, "passages", "unresolved");
  const sources = yamlCollections(corpus, "sources", "sources");
  const passagesById = uniqueCompatibilityIdentities(passages, "passage", false);
  const sourcesById = uniqueCompatibilityIdentities(sources, "source", true);
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
  return result;
}

function sourceForRecord(path: string, fragment: string, content: string): BundleSource {
  return {
    path,
    fragment,
    language: path.endsWith(".writ") ? "writ" : "yaml",
    sha256: rawHash(content),
    content,
  };
}

function projectCompatibilityRecords(corpus: NativeCorpus): BundleRecord[] {
  const records: BundleRecord[] = [];
  assertCompatibilityEvidenceIdentities(corpus);
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
          storedSource: sourceForRecord(path, recordId, exact.source),
          storedRecord: asJsonObject(exact.value, `${path}.${recordId}`),
          compiledRecord: null,
        });
      }
    }
  }
  return records;
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

function registerSource(
  corpus: NativeCorpus,
  path: string,
  registry: Map<string, SourceRegistryEntry>,
  entry: SourceRegistryEntry,
  identities: readonly string[] = entry.sourceId === null ? [] : [entry.sourceId],
): void {
  if (identities.length === 0) {
    throw new Error(`${path}: source metadata has no canonical source identity`);
  }
  for (const sourceId of identities) {
    if (registry.has(sourceId)) {
      throw new Error(`${corpus.entry.corpus_id}: duplicate source identity ${sourceId}`);
    }
    registry.set(sourceId, { ...entry, sourceId });
  }
}

/** Build source identity only from the current corpus's manifest-routed source modules. */
function sourceRegistryForCorpus(corpus: NativeCorpus): ReadonlyMap<string, SourceRegistryEntry> {
  const registry = new Map<string, SourceRegistryEntry>();
  uniqueCompatibilityIdentities(yamlCollections(corpus, "sources", "sources"), "source", true);
  const compatibilityMappings = new Map<
    string,
    {
      readonly compatibilitySourceId: string;
      readonly documentVersionId: string;
      readonly path: string;
    }
  >();
  for (const path of corpus.resources.sources) {
    const resource = source(path);
    if (resource.language === "yaml") {
      const parsed = object(parsedResource(resource), path);
      if (!Array.isArray(parsed.sources)) continue;
      for (const value of parsed.sources) {
        const mapping = object(value, `${path}.sources`);
        const projected = legalSource(mapping);
        const sourceId = text(mapping.machine_id, `${path}.sources.machine_id`);
        const aliases = strings(mapping.aliases ?? [], `${path}.${sourceId}.aliases`);
        const documentVersionIds =
          mapping.record_type === "source_document_version"
            ? strings(mapping.legacy_refs ?? [], `${path}.${sourceId}.legacy_refs`)
            : projected.documentVersionId === null
              ? []
              : [projected.documentVersionId];
        registerSource(
          corpus,
          path,
          registry,
          {
            ...projected,
            documentHash: optionalText(mapping.sha256),
            documentVersionIds,
          },
          [sourceId, ...aliases],
        );
      }
      continue;
    }
    if (resource.language !== "writ") continue;
    const parsed = parseWritDocument(resource.content, { fileName: path });
    if (!parsed.ok) {
      throw new Error(`${path}: ${parsed.diagnostics.map((item) => item.message).join("; ")}`);
    }
    const documentVersions = new Map<string, string>();
    for (const declaration of parsed.model.declarations) {
      if (!isConceptDeclaration(declaration)) continue;
      const properties = plainProperties(declaration.properties);
      const sourceId = optionalText(properties.get("source_id"));
      const documentVersionId = optionalText(properties.get("document_version_id"));
      if (documentVersionId === null) continue;
      const compatibilitySourceId = optionalText(properties.get("compatibility_source_id"));
      if (sourceId !== null && compatibilitySourceId !== null) {
        if (compatibilityMappings.has(sourceId)) {
          throw new Error(`${path}: duplicate compatibility source identity ${sourceId}`);
        }
        compatibilityMappings.set(sourceId, { compatibilitySourceId, documentVersionId, path });
        continue;
      }
      if (sourceId === null || documentVersions.has(sourceId)) {
        throw new Error(`${path}: document-version identities require one unique source_id`);
      }
      documentVersions.set(sourceId, documentVersionId);
    }
    const declaredSourceIds = new Set<string>();
    for (let index = 0; index < parsed.model.declarations.length; index += 1) {
      const declaration = parsed.model.declarations[index];
      if (!isSource(declaration)) continue;
      const metadata = parsed.model.declarations[index + 1];
      if (!isConceptDeclaration(metadata)) {
        throw new Error(`${path}: source ${declaration.name} is not followed by source metadata`);
      }
      const sourceProperties = plainProperties(declaration.properties);
      const metadataProperties = plainProperties(metadata.properties);
      const sourceId = optionalText(metadataProperties.get("source_id"));
      const documentVersionId = sourceId === null ? undefined : documentVersions.get(sourceId);
      if (sourceId === null || documentVersionId === undefined) {
        throw new Error(
          `${path}: source ${declaration.name} requires one explicit document_version_id identity`,
        );
      }
      declaredSourceIds.add(sourceId);
      registerSource(corpus, path, registry, {
        sourceId,
        documentVersionId,
        title: optionalText(metadataProperties.get("source_title")),
        uri: optionalText(sourceProperties.get("SourceUri")),
        publisher: null,
        issuedAt: optionalText(metadataProperties.get("source_date")),
        retrievedAt: optionalText(sourceProperties.get("SourceRetrieved")),
        mediaType: optionalText(sourceProperties.get("SourceMediaType")),
        sourceTier: null,
        documentHash: optionalText(sourceProperties.get("SourceSha")),
        documentVersionIds: [documentVersionId],
      });
    }
    for (const sourceId of documentVersions.keys()) {
      if (!declaredSourceIds.has(sourceId)) {
        throw new Error(`${path}: document-version identity references missing source ${sourceId}`);
      }
    }
  }
  for (const [sourceId, mapping] of compatibilityMappings) {
    const target = registry.get(mapping.compatibilitySourceId);
    if (!target) {
      throw new Error(
        `${mapping.path}: compatibility source ${sourceId} references missing structured source ${mapping.compatibilitySourceId}`,
      );
    }
    registerSource(
      corpus,
      mapping.path,
      registry,
      {
        ...target,
        sourceId,
        documentVersionId: mapping.documentVersionId,
        documentVersionIds: [mapping.documentVersionId],
      },
      [sourceId],
    );
  }
  return registry;
}

function embeddedLegalPolicySource(
  corpus: NativeCorpus,
  record: Mapping,
  sourceId: string,
  documentHash: string | null,
): SourceRegistryEntry | undefined {
  if (corpus.entry.family !== "legal_policy") return undefined;
  const metadataValue = record.source_metadata;
  if (metadataValue === undefined) return undefined;
  const metadata = object(metadataValue, `${record.record_id}.source_metadata`);
  return {
    sourceId,
    documentVersionId: null,
    title: optionalText(metadata.title),
    uri: optionalText(metadata.source_url),
    publisher: null,
    issuedAt: null,
    retrievedAt: null,
    mediaType: null,
    sourceTier: null,
    documentHash,
    documentVersionIds: [],
  };
}

function compiledEvidence(
  corpus: NativeCorpus,
  value: Mapping,
  registry: ReadonlyMap<string, SourceRegistryEntry>,
): BundleEvidenceSupport[] {
  if (!Array.isArray(value.evidence)) return [];
  return value.evidence.map((item, index) => {
    const support = object(item, `evidence[${index}]`);
    const sourceId = text(support.source_id, `evidence[${index}].source_id`);
    const documentHash = optionalText(support.document_hash);
    const documentVersionId = text(
      support.document_version_id,
      `evidence[${index}].document_version_id`,
    );
    // Native Core records may describe import lineage in source_metadata, but
    // only manifest-routed structured source declarations authorize traced
    // evidence. Frozen compatibility 0.1 retains its historical embedded
    // source behavior.
    const resolved =
      registry.get(sourceId) ??
      (corpus.manifest.record_contract.kind === "compatibility"
        ? embeddedLegalPolicySource(corpus, value, sourceId, documentHash)
        : undefined);
    if (corpus.manifest.record_contract.kind === "native" && resolved === undefined) {
      throw new Error(
        `${corpus.entry.corpus_id}: evidence source ${sourceId} does not resolve to structured source metadata`,
      );
    }
    if (
      corpus.manifest.record_contract.kind === "native" &&
      resolved !== undefined &&
      (resolved.documentHash === null || resolved.documentVersionIds.length === 0)
    ) {
      throw new Error(
        `${corpus.entry.corpus_id}: evidence source ${sourceId} lacks authoritative document hash or version metadata`,
      );
    }
    if (resolved?.documentHash && documentHash !== resolved.documentHash) {
      throw new Error(
        `${corpus.entry.corpus_id}: evidence source ${sourceId} has document hash ${documentHash ?? "null"}, expected ${resolved.documentHash}`,
      );
    }
    if (
      resolved !== undefined &&
      resolved.documentVersionIds.length > 0 &&
      !resolved.documentVersionIds.includes(documentVersionId)
    ) {
      throw new Error(
        `${corpus.entry.corpus_id}: evidence source ${sourceId} has document version ${documentVersionId}, expected ${resolved.documentVersionIds.join(", ")}`,
      );
    }
    const {
      documentHash: _registeredHash,
      documentVersionIds: _registeredVersionIds,
      ...sourceMetadata
    } = resolved ?? {
      sourceId,
      documentVersionId: null,
      title: null,
      uri: null,
      publisher: null,
      issuedAt: null,
      retrievedAt: null,
      mediaType: null,
      sourceTier: null,
      documentHash,
      documentVersionIds: [],
    };
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
      documentHash,
      reason: null,
      source: {
        ...sourceMetadata,
        documentVersionId,
      },
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
  registry: ReadonlyMap<string, SourceRegistryEntry>,
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
        evidence: compiledEvidence(corpus, record, registry),
        uncertainties: Array.isArray(record.uncertainties) ? record.uncertainties : [],
        storedSource: sourceForRecord(path, recordValue.record_id, exactSource),
        storedRecord: null,
        compiledRecord: asJsonObject(record, `${path}.${recordValue.record_id}`),
      });
    }
  }
  return records;
}

export function projectRecordLinks(corpus: NativeCorpus): BundleRecordLink[] {
  const links: BundleRecordLink[] = [];
  if (corpus.manifest.record_contract.kind === "compatibility") return links;
  for (const path of corpus.resources.relationships) {
    if (!path.endsWith(".yaml") && !path.endsWith(".yml")) continue;
    const whole = source(path);
    const value = asJsonObject(parsedResource(whole), path);
    validateAgainstContract(RECORD_LINK_CONTRACT, value, path);
    const id = text(value.link_id, `${path}.link_id`);
    const declaredOwner = text(value.owning_corpus_id, `${path}.owning_corpus_id`);
    if (declaredOwner !== corpus.entry.corpus_id) {
      throw new Error(
        `${path}: ${id} declares owning corpus ${declaredOwner} but is stored by ${corpus.entry.corpus_id}`,
      );
    }
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
        storedSource: sourceForRecord(path, value.judgment_id, exactSource),
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
  for (const corpus of repository.corpora) {
    assertSupportedRecordContract(corpus.manifest.record_contract, corpus.entry.manifest);
  }
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
      ? projectWritRecords(corpus, sourceRegistryForCorpus(corpus))
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
