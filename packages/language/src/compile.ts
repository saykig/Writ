/** Pure lowering from the active Writ AST to native records and review judgments. */
import type {
  InstitutionalRecord,
  LegalPolicyRecord,
  RecordJudgment,
  WritRecord,
} from "@writ/domain";
import type {
  InstitutionalExtension,
  JudgmentDeclaration,
  LegalPolicyExtension,
  Literal,
  Model,
  RecordDeclaration,
} from "./generated/ast.js";
import type { LanguageDiagnostic, SourceSpan } from "./diagnostics.js";
import { spanOf } from "./parse.js";
import { TOPIC_ALIASES } from "./topic-aliases.js";
import {
  recordContractForFamily,
  resolveWritDialect,
  type CompiledSchemaVersion,
} from "./contract-dispatch.js";

export interface SourceMapEntry {
  readonly key: string;
  readonly span: SourceSpan;
}

export interface CompileResult {
  readonly records: readonly WritRecord[];
  readonly judgments: readonly RecordJudgment[];
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly sourceMap: readonly SourceMapEntry[];
}

/** Reserved pure-lowering options; source dialect is always declared in the Writ document. */
export type CompileOptions = Readonly<Record<string, never>>;

export function normalizeTopic(value: string): string {
  const normalized = value.trim().toLowerCase();
  return TOPIC_ALIASES[normalized] ?? value;
}

function literalScalar(node: Literal): unknown {
  switch (node.$type) {
    case "StringLiteral":
    case "NumberLiteral":
    case "DateLiteral":
      return node.value;
    case "BooleanLiteral":
      return node.value === "true";
    case "TruthLiteral":
      return node.value;
  }
}

function lowerLegalPolicy(extension: LegalPolicyExtension | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const property of extension?.properties ?? []) {
    switch (property.$type) {
      case "InstrumentTypeProperty":
        result.instrument_type = property.value;
        break;
      case "JurisdictionLevelProperty":
        result.jurisdiction_level = property.value;
        break;
      case "ForceProperty":
        result.force = property.value;
        break;
      case "AdoptionStatusProperty":
        result.adoption_status = property.value;
        break;
      case "ApplicabilityStatusProperty":
        result.applicability_status = property.value;
        break;
      case "EnforcementStatusProperty":
        result.enforcement_status = property.value;
        break;
      case "OfficialCitationProperty":
        result.official_citation = property.value;
        break;
      case "ProvisionIdentifierProperty":
        result.provision_identifier = property.value;
        break;
      case "JurisdictionsProperty":
        result.jurisdictions = [...property.values.values];
        break;
      case "ResponsibleAuthoritiesProperty":
        result.responsible_authorities = [...property.values.values];
        break;
      case "EffectiveFromProperty":
        result.effective_from = property.value;
        break;
      case "EffectiveUntilProperty":
        result.effective_until = property.value;
        break;
      case "ExceptionsProperty":
        result.exceptions = [...property.values.values];
        break;
      case "CompliancePathwayProperty":
        result.compliance_pathway = property.value;
        break;
      case "ParentInstrumentProperty":
        result.parent_instrument_id = property.value;
        break;
      case "RelatedProvisionsProperty":
        result.related_provision_ids = [...property.values.values];
        break;
      case "SourceMetadataProperty":
        result.source_metadata = {
          dataset_name: property.datasetName,
          dataset_snapshot: property.datasetSnapshot,
          source_row_identifier: property.sourceRowIdentifier,
          source_url: property.sourceUrl ?? null,
          jurisdiction: property.jurisdiction,
          title: property.title,
          chapter: property.chapter ?? null,
          section_number: property.sectionNumber ?? null,
          section_title: property.sectionTitle ?? null,
          original_text: property.originalText,
          last_amended_year: property.lastAmendedYear ?? null,
          row_hash: property.rowHash,
        };
        break;
    }
  }
  return result;
}

function lowerRelationships(
  value: { relationships: Array<{ type: string; target: string }> } | undefined,
): Array<{ type: string; target_id: string }> {
  return (value?.relationships ?? []).map((relationship) => ({
    type: relationship.type,
    target_id: relationship.target,
  }));
}

function lowerInstitutional(
  extension: InstitutionalExtension | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let mandate: Record<string, unknown> | undefined;
  let legacyAuthoritySourceIds: string[] = [];
  for (const property of extension?.properties ?? []) {
    switch (property.$type) {
      case "InstitutionIdProperty":
        result.institution_id = property.value;
        break;
      case "InstitutionalFactTypeProperty":
        result.institutional_fact_type = property.value;
        break;
      case "InstitutionTypeProperty":
        result.institution_type = property.value;
        break;
      case "MandateProperty":
        mandate = {
          status: property.status ?? "unknown",
          ...(property.text !== undefined || property.legacyText !== undefined
            ? { text: property.text ?? property.legacyText }
            : {}),
          ...(property.authoritySourceIds
            ? { authority_source_ids: [...property.authoritySourceIds.values] }
            : {}),
          ...(property.evidenceRefs ? { evidence_refs: [...property.evidenceRefs.values] } : {}),
        };
        break;
      case "MissionProperty":
        result.mission = {
          text: property.text,
          ...(property.sourceIds ? { source_ids: [...property.sourceIds.values] } : {}),
          ...(property.evidenceRefs ? { evidence_refs: [...property.evidenceRefs.values] } : {}),
        };
        break;
      case "AuthoritySourcesProperty":
        legacyAuthoritySourceIds = [...property.values.values];
        break;
      case "InstitutionalJurisdictionsProperty":
        result.jurisdictions = [...property.values.values];
        break;
      case "FunctionsProperty":
        result.functions = [...property.values.values];
        break;
      case "InstitutionalFunctionProperty":
        result.function = property.value;
        break;
      case "OperationalCapacityProperty":
        result.operational_capacity = {
          status: property.status,
          capacity_type: property.capacityType,
          ...(property.capacityComponents
            ? { capacity_components: [...property.capacityComponents.values] }
            : {}),
          ...(property.asOfDate ? { as_of_date: property.asOfDate } : {}),
          ...(property.quantity
            ? {
                quantity: {
                  value: property.quantity.value,
                  unit: property.quantity.unit,
                  qualifier: property.quantity.qualifier,
                },
              }
            : {}),
          evidence_refs: [...property.evidenceRefs.values],
        };
        break;
      case "LegacyOperationalCapacityProperty":
        result.operational_capacity = {
          status: property.status,
          dimensions: [...property.dimensions.values],
          evidence_refs: [...property.evidenceRefs.values],
        };
        break;
      case "DecisionRightsProperty":
        result.decision_rights = [...property.values.values];
        break;
      case "DecisionRightProperty":
        result.decision_right = {
          status: property.status,
          ...(property.text !== undefined ? { text: property.text } : {}),
          ...(property.authoritySourceIds
            ? { authority_source_ids: [...property.authoritySourceIds.values] }
            : {}),
          ...(property.evidenceRefs ? { evidence_refs: [...property.evidenceRefs.values] } : {}),
        };
        break;
      case "ParentInstitutionProperty":
        result.parent_institution_id = property.value;
        break;
      case "InstitutionalRecordLinkProperty":
        result.record_link = {
          link_id: property.linkId,
          source_id: property.sourceId,
          source_kind: property.sourceKind,
          target_id: property.targetId,
          target_kind: property.targetKind,
          relation_type: property.relationType,
          basis: property.basis,
          evidence_refs: [...property.evidenceRefs.values],
        };
        break;
      case "SubunitIdsProperty":
        result.subunit_ids = [...property.values.values];
        break;
      case "OversightRelationshipsProperty":
        result.oversight_relationships = lowerRelationships(property.relationships);
        break;
      case "InstitutionalRelationshipsProperty":
        result.institutional_relationships = lowerRelationships(property.relationships);
        break;
      case "ApplicablePeriodProperty":
        result.applicable_period = {
          ...(property.from ? { from: property.from } : {}),
          ...(property.until ? { until: property.until } : {}),
        };
        break;
    }
  }
  if (mandate) {
    if (legacyAuthoritySourceIds.length > 0) {
      const current = Array.isArray(mandate.authority_source_ids)
        ? (mandate.authority_source_ids as string[])
        : [];
      mandate.authority_source_ids = [...new Set([...current, ...legacyAuthoritySourceIds])];
    }
    result.mandate = mandate;
  }
  return result;
}

function lowerRecord(
  record: RecordDeclaration,
  schemaVersion: CompiledSchemaVersion,
  sourceMap: SourceMapEntry[],
): WritRecord {
  const find = (type: string) => record.members.find((member) => member.$type === type);
  const corpus = find("RecordCorpus");
  const version = find("RecordVersion");
  const title = find("RecordTitle");
  const subjects = find("RecordSubjects");
  const assertion = find("RecordAssertion");
  const topics = find("RecordTopics");
  const scope = find("RecordScope");
  const provenance = find("RecordProvenance");
  const reviewState = find("RecordReviewState");
  const evidence = record.members
    .filter((member) => member.$type === "RecordEvidence")
    .flatMap((member) =>
      member.$type === "RecordEvidence"
        ? member.references.map((reference) => ({
            source_id: reference.source,
            document_version_id: reference.documentVersion,
            passage_id: reference.passage,
            locator: reference.locator,
            quote: reference.quote,
            passage_hash: reference.passageHash,
            document_hash: reference.documentHash,
            basis: reference.basis,
          }))
        : [],
    );
  const uncertainties = record.members
    .filter((member) => member.$type === "RecordUncertainty")
    .flatMap((member) =>
      member.$type === "RecordUncertainty"
        ? member.items.map((item) => ({ type: item.kind, description: item.description }))
        : [],
    );
  const common: Record<string, unknown> = {
    schema_version: schemaVersion,
    record_id: record.name,
    corpus_id: corpus?.$type === "RecordCorpus" ? corpus.value : "",
    record_version: version?.$type === "RecordVersion" ? version.value : "",
    family: record.family,
    title: title?.$type === "RecordTitle" ? title.value : "",
    subjects:
      subjects?.$type === "RecordSubjects"
        ? subjects.structured
          ? subjects.structured.subjects.map((subject) => ({
              subject_id: subject.subjectId,
              subject_type: subject.subjectType,
              ...(subject.label !== undefined ? { label: subject.label } : {}),
              ...(subject.role !== undefined ? { role: subject.role } : {}),
            }))
          : (subjects.legacy?.values ?? []).map((subjectId) => ({
              subject_id: subjectId,
              subject_type: "unspecified",
            }))
        : [],
    assertion:
      assertion?.$type === "RecordAssertion"
        ? { mode: assertion.mode, text: assertion.text }
        : { mode: "states", text: "" },
    topics: topics?.$type === "RecordTopics" ? topics.values.values.map(normalizeTopic) : [],
    scope:
      scope?.$type === "RecordScope"
        ? {
            jurisdictions: scope.jurisdictions
              ? [...scope.jurisdictions.values]
              : scope.legacyJurisdiction
                ? [scope.legacyJurisdiction]
                : [],
            institutional_scope: [...(scope.institutionalScope?.values ?? [])],
            temporal_scope: {
              ...(scope.temporalScope?.from ? { from: scope.temporalScope.from } : {}),
              ...(scope.temporalScope?.until ? { until: scope.temporalScope.until } : {}),
            },
            conditions: [...scope.legacyConditions, ...(scope.conditions?.values ?? [])],
          }
        : { jurisdictions: [], institutional_scope: [], temporal_scope: {}, conditions: [] },
    evidence,
    uncertainties,
    provenance:
      provenance?.$type === "RecordProvenance"
        ? { created_by: provenance.createdBy, created_at: provenance.createdAt }
        : { created_by: "", created_at: "" },
    review_state: reviewState?.$type === "RecordReviewState" ? reviewState.value : "draft",
  };
  const span = spanOf(record);
  if (span) sourceMap.push({ key: `record:${record.name}`, span });
  if (record.family === "legal_policy") {
    const extension = find("LegalPolicyExtension");
    return {
      ...common,
      ...lowerLegalPolicy(extension?.$type === "LegalPolicyExtension" ? extension : undefined),
    } as unknown as LegalPolicyRecord;
  }
  if (record.family === "institutional") {
    const extension = find("InstitutionalExtension");
    const institutional = extension?.$type === "InstitutionalExtension" ? extension : undefined;
    return {
      ...common,
      ...lowerInstitutional(institutional),
    } as unknown as InstitutionalRecord;
  }
  return common as unknown as WritRecord;
}

function lowerJudgment(
  judgment: JudgmentDeclaration,
  schemaVersion: RecordJudgment["schema_version"],
  sourceMap: SourceMapEntry[],
): RecordJudgment {
  const find = (type: string) => judgment.members.find((member) => member.$type === type);
  const target = find("JudgmentTarget");
  const type = find("JudgmentTypeProperty");
  const value = find("JudgmentValue");
  const rationale = find("JudgmentRationale");
  const evidence = find("JudgmentEvidenceRefs");
  const reviewer = find("JudgmentReviewer");
  const status = find("JudgmentStatusProperty");
  const createdAt = find("JudgmentCreatedAt");
  const family = find("JudgmentFamilyContext");
  const supersedes = find("JudgmentSupersedes");
  const supersedesIds = find("JudgmentSupersedesIds");
  const supersededBy = find("JudgmentSupersededBy");
  const related = find("RelatedJudgments");
  const span = spanOf(judgment);
  if (span) sourceMap.push({ key: `judgment:${judgment.name}`, span });
  const targetKind = target?.$type === "JudgmentTarget" ? target.kind : undefined;
  const common = {
    schema_version: schemaVersion,
    judgment_id: judgment.name,
    judgment_type: type?.$type === "JudgmentTypeProperty" ? type.value : "disagreement",
    value: value?.$type === "JudgmentValue" ? literalScalar(value.value) : null,
    rationale: rationale?.$type === "JudgmentRationale" ? rationale.value : "",
    evidence_refs: evidence?.$type === "JudgmentEvidenceRefs" ? [...evidence.values.values] : [],
    reviewer: reviewer?.$type === "JudgmentReviewer" ? reviewer.value : "",
    status: status?.$type === "JudgmentStatusProperty" ? status.value : "proposed",
    created_at: createdAt?.$type === "JudgmentCreatedAt" ? createdAt.value : "",
    ...(family?.$type === "JudgmentFamilyContext" ? { family_context: family.value } : {}),
    ...(supersedes?.$type === "JudgmentSupersedes" ? { supersedes: supersedes.value } : {}),
    ...(supersedesIds?.$type === "JudgmentSupersedesIds"
      ? { supersedes_judgment_ids: [...supersedesIds.values.values] }
      : {}),
    ...(supersededBy?.$type === "JudgmentSupersededBy"
      ? { superseded_by_judgment_id: supersededBy.value }
      : {}),
    ...(related?.$type === "RelatedJudgments"
      ? { related_judgment_ids: [...related.values.values] }
      : {}),
  };
  return {
    ...common,
    ...(targetKind
      ? {
          target_kind: targetKind,
          target_id: target?.$type === "JudgmentTarget" ? target.value : "",
        }
      : { target_record_id: target?.$type === "JudgmentTarget" ? target.value : "" }),
  } as RecordJudgment;
}

export function compileModel(model: Model, _options: CompileOptions = {}): CompileResult {
  const sourceMap: SourceMapEntry[] = [];
  const contracts = resolveWritDialect(model.languageVersion);
  if (!contracts) {
    const modelSpan = spanOf(model);
    return {
      records: [],
      judgments: [],
      diagnostics: [
        {
          code: "WRT-DIALECT-UNSUPPORTED",
          severity: "error",
          message: `Unsupported Writ source dialect: ${model.languageVersion}`,
          ...(modelSpan ? { span: modelSpan } : {}),
        },
      ],
      sourceMap,
    };
  }
  const records = model.declarations
    .filter(
      (declaration): declaration is RecordDeclaration => declaration.$type === "RecordDeclaration",
    )
    .map((record) =>
      lowerRecord(
        record,
        recordContractForFamily(contracts, record.family).schemaVersion,
        sourceMap,
      ),
    );
  const judgments = model.declarations
    .filter(
      (declaration): declaration is JudgmentDeclaration =>
        declaration.$type === "JudgmentDeclaration",
    )
    .map((judgment) => lowerJudgment(judgment, contracts.judgment.schemaVersion, sourceMap));
  return { records, judgments, diagnostics: [], sourceMap };
}
