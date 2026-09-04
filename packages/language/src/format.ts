/** Canonical pretty-printer for the active source, record, and judgment language. */
import type {
  ConceptDeclaration,
  Declaration,
  InstitutionalProperty,
  JudgmentDeclaration,
  LegalPolicyProperty,
  Literal,
  Model,
  RecordDeclaration,
  RecordMember,
  Source,
} from "./generated/ast.js";
import { parseDocument } from "./parse.js";

const INDENT = "  ";
const quote = (value: string): string => JSON.stringify(value);
const num = (value: number): string => String(value);
const identifiers = (values: readonly string[]): string => `{ ${values.join(", ")} }`;
const strings = (values: readonly string[]): string => `{ ${values.map(quote).join(", ")} }`;

export function printLiteral(node: Literal): string {
  switch (node.$type) {
    case "StringLiteral":
      return quote(node.value);
    case "NumberLiteral":
      return num(node.value);
    case "BooleanLiteral":
    case "TruthLiteral":
    case "DateLiteral":
      return String(node.value);
  }
}

function printSource(source: Source): string {
  const lines = [`source ${source.name} {`];
  for (const property of source.properties) {
    switch (property.$type) {
      case "SourceUri":
        lines.push(`${INDENT}uri ${quote(property.value)};`);
        break;
      case "SourceMediaType":
        lines.push(`${INDENT}media_type ${quote(property.value)};`);
        break;
      case "SourceRetrieved":
        lines.push(`${INDENT}retrieved ${property.value};`);
        break;
      case "SourceSha":
        lines.push(`${INDENT}sha256 ${quote(property.value)};`);
        break;
    }
  }
  lines.push("}");
  return lines.join("\n");
}

function printConcept(concept: ConceptDeclaration): string {
  const base = concept.base ? ` : ${concept.base}` : "";
  const lines = [`concept ${concept.name}${base} {`];
  for (const property of concept.properties) {
    const value =
      typeof property.value === "number"
        ? num(property.value)
        : /^[0-9]/.test(property.value)
          ? property.value
          : String(property.value);
    lines.push(`${INDENT}${property.name} ${value};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function printLegalProperty(property: LegalPolicyProperty, indent: string): string {
  switch (property.$type) {
    case "InstrumentTypeProperty":
      return `${indent}instrument_type ${property.value};`;
    case "JurisdictionLevelProperty":
      return `${indent}jurisdiction_level ${property.value};`;
    case "ForceProperty":
      return `${indent}force ${property.value};`;
    case "AdoptionStatusProperty":
      return `${indent}adoption_status ${property.value};`;
    case "ApplicabilityStatusProperty":
      return `${indent}applicability_status ${property.value};`;
    case "EnforcementStatusProperty":
      return `${indent}enforcement_status ${property.value};`;
    case "OfficialCitationProperty":
      return `${indent}official_citation ${quote(property.value)};`;
    case "ProvisionIdentifierProperty":
      return `${indent}provision_identifier ${quote(property.value)};`;
    case "JurisdictionsProperty":
      return `${indent}jurisdictions ${strings(property.values.values)};`;
    case "ResponsibleAuthoritiesProperty":
      return `${indent}responsible_authorities ${identifiers(property.values.values)};`;
    case "EffectiveFromProperty":
      return `${indent}effective_from ${property.value};`;
    case "EffectiveUntilProperty":
      return `${indent}effective_until ${property.value};`;
    case "ExceptionsProperty":
      return `${indent}exceptions ${strings(property.values.values)};`;
    case "CompliancePathwayProperty":
      return `${indent}compliance_pathway ${quote(property.value)};`;
    case "ParentInstrumentProperty":
      return `${indent}parent_instrument_id ${property.value};`;
    case "RelatedProvisionsProperty":
      return `${indent}related_provision_ids ${identifiers(property.values.values)};`;
    case "SourceMetadataProperty": {
      const lines = [
        `${indent}source_metadata {`,
        `${indent}${INDENT}dataset_name ${quote(property.datasetName)};`,
        `${indent}${INDENT}dataset_snapshot ${quote(property.datasetSnapshot)};`,
        `${indent}${INDENT}source_row_identifier ${quote(property.sourceRowIdentifier)};`,
      ];
      if (property.sourceUrl)
        lines.push(`${indent}${INDENT}source_url ${quote(property.sourceUrl)};`);
      lines.push(
        `${indent}${INDENT}jurisdiction ${quote(property.jurisdiction)};`,
        `${indent}${INDENT}title ${quote(property.title)};`,
      );
      if (property.chapter) lines.push(`${indent}${INDENT}chapter ${quote(property.chapter)};`);
      if (property.sectionNumber)
        lines.push(`${indent}${INDENT}section_number ${quote(property.sectionNumber)};`);
      if (property.sectionTitle)
        lines.push(`${indent}${INDENT}section_title ${quote(property.sectionTitle)};`);
      lines.push(`${indent}${INDENT}original_text ${quote(property.originalText)};`);
      if (property.lastAmendedYear !== undefined)
        lines.push(`${indent}${INDENT}last_amended_year ${num(property.lastAmendedYear)};`);
      lines.push(`${indent}${INDENT}row_hash ${quote(property.rowHash)};`, `${indent}}`);
      return lines.join("\n");
    }
  }
}

function printRelationships(relationships: readonly { type: string; target: string }[]): string {
  if (relationships.length === 0) return "{}";
  const rows = relationships.map(
    (relationship) => `${INDENT.repeat(3)}relation ${relationship.type} ${relationship.target};`,
  );
  return `{\n${rows.join("\n")}\n${INDENT.repeat(2)}}`;
}

function printInstitutionalProperty(property: InstitutionalProperty, indent: string): string {
  switch (property.$type) {
    case "InstitutionIdProperty":
      return `${indent}institution_id ${property.value};`;
    case "InstitutionalFactTypeProperty":
      return `${indent}fact_type ${property.value};`;
    case "InstitutionTypeProperty":
      return `${indent}institution_type ${property.value};`;
    case "MandateProperty": {
      if (property.legacyText !== undefined)
        return `${indent}mandate ${quote(property.legacyText)};`;
      const lines = [`${indent}mandate {`, `${indent}${INDENT}status ${property.status};`];
      if (property.text !== undefined)
        lines.push(`${indent}${INDENT}text ${quote(property.text)};`);
      if (property.authoritySourceIds)
        lines.push(
          `${indent}${INDENT}authority_source_ids ${identifiers(property.authoritySourceIds.values)};`,
        );
      if (property.evidenceRefs)
        lines.push(`${indent}${INDENT}evidence_refs ${identifiers(property.evidenceRefs.values)};`);
      lines.push(`${indent}}`);
      return lines.join("\n");
    }
    case "MissionProperty": {
      const lines = [`${indent}mission {`, `${indent}${INDENT}text ${quote(property.text)};`];
      if (property.sourceIds)
        lines.push(`${indent}${INDENT}source_ids ${identifiers(property.sourceIds.values)};`);
      if (property.evidenceRefs)
        lines.push(`${indent}${INDENT}evidence_refs ${identifiers(property.evidenceRefs.values)};`);
      lines.push(`${indent}}`);
      return lines.join("\n");
    }
    case "AuthoritySourcesProperty":
      return `${indent}authority_sources ${identifiers(property.values.values)};`;
    case "InstitutionalJurisdictionsProperty":
      return `${indent}jurisdictions ${strings(property.values.values)};`;
    case "FunctionsProperty":
      return `${indent}functions ${identifiers(property.values.values)};`;
    case "InstitutionalFunctionProperty":
      return `${indent}function ${property.value};`;
    case "OperationalCapacityProperty": {
      const lines = [
        `${indent}operational_capacity {`,
        `${indent}${INDENT}status ${property.status};`,
        `${indent}${INDENT}capacity_type ${property.capacityType};`,
      ];
      if (property.capacityComponents)
        lines.push(
          `${indent}${INDENT}capacity_components ${identifiers(property.capacityComponents.values)};`,
        );
      if (property.asOfDate) lines.push(`${indent}${INDENT}as_of_date ${property.asOfDate};`);
      if (property.quantity)
        lines.push(
          `${indent}${INDENT}quantity {`,
          `${indent}${INDENT.repeat(2)}value ${num(property.quantity.value)};`,
          `${indent}${INDENT.repeat(2)}unit ${property.quantity.unit};`,
          `${indent}${INDENT.repeat(2)}qualifier ${property.quantity.qualifier};`,
          `${indent}${INDENT}}`,
        );
      lines.push(`${indent}${INDENT}evidence_refs ${identifiers(property.evidenceRefs.values)};`);
      lines.push(`${indent}}`);
      return lines.join("\n");
    }
    case "LegacyOperationalCapacityProperty":
      return `${indent}operational_capacity {\n${indent}${INDENT}status ${property.status};\n${indent}${INDENT}dimensions ${strings(property.dimensions.values)};\n${indent}${INDENT}evidence_refs ${identifiers(property.evidenceRefs.values)};\n${indent}}`;
    case "DecisionRightsProperty":
      return `${indent}decision_rights ${strings(property.values.values)};`;
    case "DecisionRightProperty": {
      const lines = [`${indent}decision_right {`, `${indent}${INDENT}status ${property.status};`];
      if (property.text !== undefined)
        lines.push(`${indent}${INDENT}text ${quote(property.text)};`);
      if (property.authoritySourceIds)
        lines.push(
          `${indent}${INDENT}authority_source_ids ${identifiers(property.authoritySourceIds.values)};`,
        );
      if (property.evidenceRefs)
        lines.push(`${indent}${INDENT}evidence_refs ${identifiers(property.evidenceRefs.values)};`);
      lines.push(`${indent}}`);
      return lines.join("\n");
    }
    case "ParentInstitutionProperty":
      return `${indent}parent_institution_id ${property.value};`;
    case "InstitutionalRecordLinkProperty":
      return `${indent}record_link {\n${indent}${INDENT}link_id ${property.linkId};\n${indent}${INDENT}source ${property.sourceId} kind ${property.sourceKind};\n${indent}${INDENT}target ${property.targetId} kind ${property.targetKind};\n${indent}${INDENT}relation ${property.relationType};\n${indent}${INDENT}basis ${property.basis};\n${indent}${INDENT}evidence_refs ${identifiers(property.evidenceRefs.values)};\n${indent}}`;
    case "SubunitIdsProperty":
      return `${indent}subunit_ids ${identifiers(property.values.values)};`;
    case "OversightRelationshipsProperty":
      return `${indent}oversight_relationships ${printRelationships(property.relationships.relationships)};`;
    case "InstitutionalRelationshipsProperty":
      return `${indent}institutional_relationships ${printRelationships(property.relationships.relationships)};`;
    case "ApplicablePeriodProperty": {
      const lines = [`${indent}applicable_period {`];
      if (property.from) lines.push(`${indent}${INDENT}from ${property.from};`);
      if (property.until) lines.push(`${indent}${INDENT}until ${property.until};`);
      lines.push(`${indent}}`);
      return lines.join("\n");
    }
  }
}

function printRecordMember(member: RecordMember, indent: string): string {
  switch (member.$type) {
    case "RecordCorpus":
      return `${indent}corpus ${member.value};`;
    case "RecordVersion":
      return `${indent}version ${quote(member.value)};`;
    case "RecordTitle":
      return `${indent}title ${quote(member.value)};`;
    case "RecordSubjects": {
      if (member.legacy) return `${indent}subjects ${identifiers(member.legacy.values)};`;
      const lines = [`${indent}subjects {`];
      for (const subject of member.structured?.subjects ?? [])
        lines.push(
          `${indent}${INDENT}subject ${subject.subjectId} type ${subject.subjectType}${subject.label ? ` label ${quote(subject.label)}` : ""}${subject.role ? ` role ${quote(subject.role)}` : ""};`,
        );
      lines.push(`${indent}};`);
      return lines.join("\n");
    }
    case "RecordAssertion":
      return `${indent}assertion ${member.mode} ${quote(member.text)};`;
    case "RecordTopics":
      return `${indent}topics { ${member.values.values.map((value) => (value.includes(" ") ? quote(value) : value)).join(", ")} };`;
    case "RecordScope": {
      const lines = [`${indent}scope {`];
      if (member.legacyJurisdiction)
        lines.push(`${indent}${INDENT}jurisdiction ${quote(member.legacyJurisdiction)};`);
      if (member.jurisdictions)
        lines.push(`${indent}${INDENT}jurisdictions ${strings(member.jurisdictions.values)};`);
      if (member.institutionalScope)
        lines.push(
          `${indent}${INDENT}institutional_scope ${identifiers(member.institutionalScope.values)};`,
        );
      if (member.temporalScope) {
        lines.push(`${indent}${INDENT}temporal_scope {`);
        if (member.temporalScope.from)
          lines.push(`${indent}${INDENT.repeat(2)}from ${member.temporalScope.from};`);
        if (member.temporalScope.until)
          lines.push(`${indent}${INDENT.repeat(2)}until ${member.temporalScope.until};`);
        lines.push(`${indent}${INDENT}}`);
      }
      for (const condition of member.legacyConditions)
        lines.push(`${indent}${INDENT}condition ${quote(condition)};`);
      if (member.conditions)
        lines.push(`${indent}${INDENT}conditions ${strings(member.conditions.values)};`);
      lines.push(`${indent}}`);
      return lines.join("\n");
    }
    case "RecordEvidence": {
      const lines = [`${indent}evidence {`];
      for (const reference of member.references)
        lines.push(
          `${indent}${INDENT}support ${reference.source} document_version ${reference.documentVersion} passage ${reference.passage} locator ${quote(reference.locator)} quote ${quote(reference.quote)} passage_hash ${quote(reference.passageHash)} document_hash ${quote(reference.documentHash)} basis ${reference.basis};`,
        );
      lines.push(`${indent}}`);
      return lines.join("\n");
    }
    case "RecordUncertainty": {
      const lines = [`${indent}uncertainty {`];
      for (const item of member.items)
        lines.push(`${indent}${INDENT}item ${item.kind} ${quote(item.description)};`);
      lines.push(`${indent}}`);
      return lines.join("\n");
    }
    case "RecordProvenance":
      return `${indent}provenance {\n${indent}${INDENT}created_by ${quote(member.createdBy)};\n${indent}${INDENT}created_at ${member.createdAt};\n${indent}}`;
    case "RecordReviewState":
      return `${indent}review_state ${member.value};`;
    case "LegalPolicyExtension":
      return `${indent}legal_policy {\n${member.properties.map((property) => printLegalProperty(property, indent + INDENT)).join("\n")}\n${indent}}`;
    case "InstitutionalExtension":
      return `${indent}institutional {\n${member.properties.map((property) => printInstitutionalProperty(property, indent + INDENT)).join("\n")}\n${indent}}`;
  }
}

function printRecord(record: RecordDeclaration): string {
  const lines = [`record ${record.name} : ${record.family} {`];
  for (const member of record.members) lines.push(printRecordMember(member, INDENT));
  lines.push("}");
  return lines.join("\n");
}

function printJudgment(judgment: JudgmentDeclaration): string {
  const lines = [`judgment ${judgment.name} {`];
  for (const member of judgment.members) {
    switch (member.$type) {
      case "JudgmentTarget":
        lines.push(`${INDENT}target ${member.kind ? `${member.kind} ` : ""}${member.value};`);
        break;
      case "JudgmentTypeProperty":
        lines.push(`${INDENT}type ${member.value};`);
        break;
      case "JudgmentValue":
        lines.push(`${INDENT}value ${printLiteral(member.value)};`);
        break;
      case "JudgmentRationale":
        lines.push(`${INDENT}rationale ${quote(member.value)};`);
        break;
      case "JudgmentEvidenceRefs":
        lines.push(`${INDENT}evidence_refs ${identifiers(member.values.values)};`);
        break;
      case "JudgmentReviewer":
        lines.push(`${INDENT}reviewer ${quote(member.value)};`);
        break;
      case "JudgmentStatusProperty":
        lines.push(`${INDENT}status ${member.value};`);
        break;
      case "JudgmentCreatedAt":
        lines.push(`${INDENT}created_at ${member.value};`);
        break;
      case "JudgmentFamilyContext":
        lines.push(`${INDENT}family_context ${member.value};`);
        break;
      case "JudgmentSupersedes":
        lines.push(`${INDENT}supersedes ${member.value};`);
        break;
      case "JudgmentSupersedesIds":
        lines.push(`${INDENT}supersedes_judgment_ids ${identifiers(member.values.values)};`);
        break;
      case "JudgmentSupersededBy":
        lines.push(`${INDENT}superseded_by_judgment_id ${member.value};`);
        break;
      case "JudgmentReviewArtifact":
        lines.push(
          `${INDENT}review_artifact {`,
          `${INDENT.repeat(2)}path ${quote(member.path)};`,
          `${INDENT.repeat(2)}content_hash ${quote(member.contentHash)};`,
          `${INDENT}}`,
        );
        break;
      case "RelatedJudgments":
        lines.push(`${INDENT}related_judgment_ids ${identifiers(member.values.values)};`);
        break;
    }
  }
  lines.push("}");
  return lines.join("\n");
}

function printDeclaration(declaration: Declaration): string {
  switch (declaration.$type) {
    case "Source":
      return printSource(declaration);
    case "ConceptDeclaration":
      return printConcept(declaration);
    case "RecordDeclaration":
      return printRecord(declaration);
    case "JudgmentDeclaration":
      return printJudgment(declaration);
  }
}

export function printModel(model: Model): string {
  const blocks = [
    `language writ ${quote(model.languageVersion)}\npackage ${model.packageName} version ${quote(model.packageVersion)};`,
    ...model.declarations.map(printDeclaration),
  ];
  return `${blocks.join("\n\n")}\n`;
}

export function formatText(
  text: string,
  options: { readonly literate?: boolean; readonly fileName?: string } = {},
): string {
  const parsed = parseDocument(text, options);
  return parsed.ok ? printModel(parsed.model) : text;
}
