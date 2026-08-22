grammar Writ

// Writ's active surface is deliberately limited to source-grounded records
// and the judgments that preserve human review history.
entry Model:
    'language' 'writ' languageVersion=STRING
    'package' packageName=QualifiedName 'version' packageVersion=STRING ';'
    declarations+=Declaration*;

Declaration: Source | ConceptDeclaration | RecordDeclaration | JudgmentDeclaration;

Source:
    'source' name=ID '{' properties+=SourceProperty* '}';
SourceProperty:
      {infer SourceUri} 'uri' value=STRING ';'
    | {infer SourceMediaType} 'media_type' value=STRING ';'
    | {infer SourceRetrieved} 'retrieved' value=DATETIME ';'
    | {infer SourceSha} 'sha256' value=STRING ';';

ConceptDeclaration:
    'concept' name=ID (':' base=QualifiedName)? '{' properties+=ConceptProperty* '}';
ConceptProperty:
    name=ID value=(STRING | NUMBER | DATE | QualifiedName) ';';

RecordDeclaration:
    'record' name=ID ':' family=RecordFamily '{' members+=RecordMember* '}';
RecordFamily returns string: ID | 'legal_policy' | 'institutional';
RecordMember:
      {infer RecordCorpus} 'corpus' value=QualifiedName ';'
    | {infer RecordVersion} 'version' value=STRING ';'
    | {infer RecordTitle} 'title' value=STRING ';'
    | RecordSubjects
    | RecordAssertion
    | RecordTopics
    | RecordScope
    | RecordEvidence
    | RecordUncertainty
    | RecordProvenance
    | {infer RecordReviewState} 'review_state' value=ReviewState ';'
    | LegalPolicyExtension
    | InstitutionalExtension;

RecordSubjects:
    'subjects' (structured=StructuredRecordSubjectList | legacy=IdentifierList) ';';
StructuredRecordSubjectList: '{' subjects+=RecordSubject+ '}';
RecordSubject:
    'subject' subjectId=QualifiedName 'type' subjectType=QualifiedName
    ('label' label=STRING)? ('role' role=STRING)? ';';
RecordTopics: 'topics' values=TopicList ';';
RecordAssertion: 'assertion' mode=RecordAssertionMode text=STRING ';';
RecordAssertionMode returns string:
    'requires' | 'permits' | 'prohibits' | 'defines' | 'authorizes' | 'assigns'
    | 'performs' | 'states' | 'observes';

RecordScope:
    'scope' '{'
        ('jurisdiction' legacyJurisdiction=STRING ';')?
        ('jurisdictions' jurisdictions=StringList ';')?
        ('institutional_scope' institutionalScope=IdentifierList ';')?
        ('temporal_scope' temporalScope=RecordTemporalScope)?
        ('condition' legacyConditions+=STRING ';')*
        ('conditions' conditions=StringList ';')?
    '}';
RecordTemporalScope: '{' ('from' from=DATE ';')? ('until' until=DATE ';')? '}';

RecordEvidence: 'evidence' '{' references+=RecordEvidenceReference+ '}';
RecordEvidenceReference:
    'support' source=QualifiedName
    'document_version' documentVersion=QualifiedName
    'passage' passage=QualifiedName
    'locator' locator=STRING
    'quote' quote=STRING
    'passage_hash' passageHash=STRING
    'document_hash' documentHash=STRING
    'basis' basis=EvidenceBasis ';';
EvidenceBasis returns string: 'direct' | 'inferred' | 'inherited';

RecordUncertainty: 'uncertainty' '{' items+=RecordUncertaintyItem* '}';
RecordUncertaintyItem: 'item' kind=UncertaintyType description=STRING ';';
UncertaintyType returns string: 'unknown' | 'contested' | 'ambiguous' | 'incomplete_evidence';
RecordProvenance:
    'provenance' '{' 'created_by' createdBy=STRING ';' 'created_at' createdAt=DATE ';' '}';
ReviewState returns string: 'draft' | 'reviewed' | 'approved' | 'superseded' | 'withdrawn';

LegalPolicyExtension: 'legal_policy' '{' properties+=LegalPolicyProperty* '}';
LegalPolicyProperty:
      {infer InstrumentTypeProperty} 'instrument_type' value=InstrumentType ';'
    | {infer JurisdictionLevelProperty} 'jurisdiction_level' value=JurisdictionLevel ';'
    | {infer ForceProperty} 'force' value=LegalForce ';'
    | {infer AdoptionStatusProperty} 'adoption_status' value=AdoptionStatus ';'
    | {infer ApplicabilityStatusProperty} 'applicability_status' value=ApplicabilityStatus ';'
    | {infer EnforcementStatusProperty} 'enforcement_status' value=EnforcementStatus ';'
    | {infer OfficialCitationProperty} 'official_citation' value=STRING ';'
    | {infer ProvisionIdentifierProperty} 'provision_identifier' value=STRING ';'
    | {infer JurisdictionsProperty} 'jurisdictions' values=StringList ';'
    | {infer ResponsibleAuthoritiesProperty} 'responsible_authorities' values=IdentifierList ';'
    | {infer EffectiveFromProperty} 'effective_from' value=DATE ';'
    | {infer EffectiveUntilProperty} 'effective_until' value=DATE ';'
    | {infer ExceptionsProperty} 'exceptions' values=StringList ';'
    | {infer CompliancePathwayProperty} 'compliance_pathway' value=STRING ';'
    | {infer ParentInstrumentProperty} 'parent_instrument_id' value=QualifiedName ';'
    | {infer RelatedProvisionsProperty} 'related_provision_ids' values=IdentifierList ';'
    | SourceMetadataProperty;
SourceMetadataProperty:
    'source_metadata' '{'
        'dataset_name' datasetName=STRING ';'
        'dataset_snapshot' datasetSnapshot=STRING ';'
        'source_row_identifier' sourceRowIdentifier=STRING ';'
        ('source_url' sourceUrl=STRING ';')?
        'jurisdiction' jurisdiction=STRING ';'
        'title' title=STRING ';'
        ('chapter' chapter=STRING ';')?
        ('section_number' sectionNumber=STRING ';')?
        ('section_title' sectionTitle=STRING ';')?
        'original_text' originalText=STRING ';'
        ('last_amended_year' lastAmendedYear=NUMBER ';')?
        'row_hash' rowHash=STRING ';'
    '}';

InstrumentType returns string: 'constitution' | 'constitutional_amendment' | 'statute' | 'regulation' | 'executive_order' | 'agency_policy' | 'guidance' | 'code' | 'other' | 'unknown';
JurisdictionLevel returns string: 'federal' | 'state' | 'territorial' | 'district' | 'institution_specific' | 'unknown';
LegalForce returns string: 'binding' | 'nonbinding' | 'voluntary' | 'proposed' | 'unknown';
AdoptionStatus returns string: 'adopted' | 'proposed' | 'rescinded' | 'superseded' | 'unknown';
ApplicabilityStatus returns string: 'generally_applicable' | 'market_wide' | 'provider_specific' | 'government_use' | 'procurement' | 'institution_specific' | 'not_yet_applicable' | 'unknown';
EnforcementStatus returns string: 'judicial' | 'administrative' | 'contractual' | 'oversight' | 'self_executing' | 'none_specified' | 'unknown';

InstitutionalExtension: 'institutional' '{' properties+=InstitutionalProperty* '}';
InstitutionalProperty:
      {infer InstitutionIdProperty} 'institution_id' value=QualifiedName ';'
    | {infer InstitutionalFactTypeProperty} 'fact_type' value=InstitutionalFactType ';'
    | {infer InstitutionTypeProperty} 'institution_type' value=InstitutionType ';'
    | MandateProperty
    | MissionProperty
    | {infer AuthoritySourcesProperty} 'authority_sources' values=IdentifierList ';'
    | {infer InstitutionalJurisdictionsProperty} 'jurisdictions' values=StringList ';'
    | {infer FunctionsProperty} 'functions' values=FunctionList ';'
    | {infer InstitutionalFunctionProperty} 'function' value=QualifiedName ';'
    | OperationalCapacityProperty
    | LegacyOperationalCapacityProperty
    | {infer DecisionRightsProperty} 'decision_rights' values=StringList ';'
    | DecisionRightProperty
    | {infer ParentInstitutionProperty} 'parent_institution_id' value=QualifiedName ';'
    | InstitutionalRecordLinkProperty
    | {infer SubunitIdsProperty} 'subunit_ids' values=IdentifierList ';'
    | OversightRelationshipsProperty
    | InstitutionalRelationshipsProperty
    | ApplicablePeriodProperty;

InstitutionType returns string: 'government_department' | 'federal_agency' | 'independent_agency' | 'advisory_body' | 'regulator' | 'standards_body' | 'research_body' | 'interagency_body' | 'organizational_unit' | 'supranational_institution' | 'other' | 'unknown';
InstitutionalFactType returns string: 'identity' | 'placement' | 'relationship' | 'mission' | 'mandate' | 'function' | 'decision_right' | 'operational_capacity';
InstitutionalRecordLinkProperty:
    'record_link' '{'
        'link_id' linkId=QualifiedName ';'
        'source' sourceId=QualifiedName 'kind' sourceKind=QualifiedName ';'
        'target' targetId=QualifiedName 'kind' targetKind=QualifiedName ';'
        'relation' relationType=RecordLinkRelationType ';'
        'basis' basis=EvidenceBasis ';'
        'evidence_refs' evidenceRefs=IdentifierList ';'
    '}';
RecordLinkRelationType returns string: 'issued_by' | 'administered_by' | 'implemented_by' | 'enforced_by' | 'establishes' | 'authorizes' | 'assigns_function_to' | 'derives_authority_from' | 'part_of' | 'oversees' | 'applies_to';
InstitutionFunction returns string: 'standards_development' | 'measurement_science' | 'technical_guidance' | 'research' | 'evaluation' | 'coordination' | 'oversight' | 'grant_administration' | 'procurement_support' | 'other';
MandateProperty:
    'mandate' ('{' 'status' status=MandateStatus ';' ('text' text=STRING ';')?
        ('authority_source_ids' authoritySourceIds=IdentifierList ';')?
        ('evidence_refs' evidenceRefs=IdentifierList ';')? '}' | legacyText=STRING ';');
MandateStatus returns string: 'established' | 'unknown' | 'contested';
MissionProperty:
    'mission' '{' 'text' text=STRING ';' ('source_ids' sourceIds=IdentifierList ';')?
        ('evidence_refs' evidenceRefs=IdentifierList ';')? '}';
OperationalCapacityProperty:
    'operational_capacity' '{'
        'status' status=CapacityStatus ';'
        'capacity_type' capacityType=CapacityType ';'
        ('capacity_components' capacityComponents=IdentifierList ';')?
        ('as_of_date' asOfDate=DATE ';')?
        ('quantity' quantity=CapacityQuantity)?
        'evidence_refs' evidenceRefs=IdentifierList ';'
    '}';
CapacityStatus returns string: 'active' | 'planned' | 'limited' | 'degraded' | 'suspended' | 'retired' | 'unknown';
CapacityType returns string: 'organizational_unit' | 'laboratory_network' | 'facility' | 'program' | 'technical_capability' | 'accreditation_system' | 'partnership_network' | 'other';
CapacityQuantity:
    '{' 'value' value=NUMBER ';' 'unit' unit=QualifiedName ';'
        'qualifier' qualifier=CapacityQuantityQualifier ';' '}';
CapacityQuantityQualifier returns string: 'exact' | 'approximate' | 'minimum' | 'maximum';
LegacyOperationalCapacityProperty:
    'operational_capacity' '{' 'status' status=LegacyCapacityStatus ';'
        'dimensions' dimensions=StringList ';' 'evidence_refs' evidenceRefs=IdentifierList ';' '}';
LegacyCapacityStatus returns string: 'established' | 'partial' | 'unknown' | 'contested';
DecisionRightProperty:
    'decision_right' '{' 'status' status=MandateStatus ';' ('text' text=STRING ';')?
        ('authority_source_ids' authoritySourceIds=IdentifierList ';')?
        ('evidence_refs' evidenceRefs=IdentifierList ';')? '}';
OversightRelationshipsProperty: 'oversight_relationships' relationships=RelationshipList ';';
InstitutionalRelationshipsProperty: 'institutional_relationships' relationships=RelationshipList ';';
RelationshipList: '{' relationships+=InstitutionalRelationship* '}';
InstitutionalRelationship: 'relation' type=InstitutionalRelationType target=QualifiedName ';';
InstitutionalRelationType returns string: 'part_of' | 'oversees' | 'supports' | 'advises' | 'coordinates_with' | 'reports_to' | 'implements_for';
ApplicablePeriodProperty: 'applicable_period' '{' ('from' from=DATE ';')? ('until' until=DATE ';')? '}';

JudgmentDeclaration: 'judgment' name=ID '{' members+=JudgmentMember* '}';
JudgmentMember:
      {infer JudgmentTarget} 'target' (kind=JudgmentTargetKind)? value=QualifiedName ';'
    | {infer JudgmentTypeProperty} 'type' value=JudgmentType ';'
    | {infer JudgmentValue} 'value' value=Literal ';'
    | {infer JudgmentRationale} 'rationale' value=STRING ';'
    | {infer JudgmentEvidenceRefs} 'evidence_refs' values=IdentifierList ';'
    | {infer JudgmentReviewer} 'reviewer' value=STRING ';'
    | {infer JudgmentStatusProperty} 'status' value=JudgmentStatus ';'
    | {infer JudgmentCreatedAt} 'created_at' value=DATE ';'
    | {infer JudgmentFamilyContext} 'family_context' value=RecordFamily ';'
    | {infer JudgmentSupersedes} 'supersedes' value=QualifiedName ';'
    | {infer JudgmentSupersedesIds} 'supersedes_judgment_ids' values=IdentifierList ';'
    | {infer JudgmentSupersededBy} 'superseded_by_judgment_id' value=QualifiedName ';'
    | {infer RelatedJudgments} 'related_judgment_ids' values=IdentifierList ';';
JudgmentType returns string: 'passage_selection' | 'record_family_classification' | 'subject_identification' | 'scope_interpretation' | 'topic_classification' | 'legal_status_determination' | 'institutional_role_determination' | 'operational_capacity_determination' | 'direct_or_inferred' | 'disagreement' | 'adjudication' | 'review_disposition' | 'record_link_disposition';
JudgmentStatus returns string: 'proposed' | 'accepted' | 'contested' | 'superseded';
JudgmentTargetKind returns string: 'record' | 'record_link';

IdentifierList: '{' (values+=QualifiedName (',' values+=QualifiedName)* ','?)? '}';
StringList: '{' values+=STRING (',' values+=STRING)* ','? '}' | {infer EmptyStringList} '{' '}';
TopicList: '{' values+=(QualifiedName | STRING) (',' values+=(QualifiedName | STRING))* ','? '}' | {infer EmptyTopicList} '{' '}';
FunctionList: '{' values+=InstitutionFunction (',' values+=InstitutionFunction)* ','? '}';

type Literal = StringLiteral | NumberLiteral | BooleanLiteral | TruthLiteral | DateLiteral;
Literal returns Literal:
      {infer StringLiteral} value=STRING
    | {infer NumberLiteral} value=NUMBER
    | {infer BooleanLiteral} value=('true' | 'false')
    | {infer TruthLiteral} value=('unknown' | 'contested')
    | {infer DateLiteral} value=DATE;

QualifiedName returns string: NamePart ('.' NamePart)*;
NamePart returns string:
    ID | 'writ' | 'record' | 'judgment' | 'legal_policy' | 'institutional' | 'corpus'
    | 'version' | 'title' | 'subjects' | 'assertion' | 'topics' | 'scope' | 'evidence'
    | 'uncertainty' | 'provenance' | 'review_state' | 'support' | 'document_version'
    | 'passage' | 'locator' | 'quote' | 'passage_hash' | 'document_hash' | 'basis'
    | 'direct' | 'inferred' | 'inherited' | 'unknown' | 'contested' | 'ambiguous'
    | 'incomplete_evidence' | 'draft' | 'reviewed' | 'approved' | 'superseded'
    | 'withdrawn' | 'requires' | 'permits' | 'prohibits' | 'defines' | 'authorizes'
    | 'assigns' | 'performs' | 'states' | 'observes' | 'jurisdiction' | 'condition'
    | 'conditions' | 'jurisdictions' | 'institutional_scope' | 'temporal_scope'
    | 'subject' | 'label' | 'role' | 'item' | 'created_by' | 'created_at'
    | 'instrument_type' | 'jurisdiction_level' | 'force' | 'adoption_status'
    | 'applicability_status' | 'enforcement_status' | 'official_citation'
    | 'provision_identifier' | 'responsible_authorities' | 'effective_from'
    | 'effective_until' | 'exceptions' | 'compliance_pathway' | 'parent_instrument_id'
    | 'related_provision_ids' | 'source_metadata' | 'dataset_name' | 'dataset_snapshot'
    | 'source_row_identifier' | 'source_url' | 'chapter' | 'section_number'
    | 'section_title' | 'original_text' | 'last_amended_year' | 'row_hash'
    | 'constitution' | 'constitutional_amendment' | 'statute' | 'regulation'
    | 'executive_order' | 'agency_policy' | 'guidance' | 'code' | 'other' | 'federal'
    | 'state' | 'territorial' | 'district' | 'institution_specific' | 'binding'
    | 'nonbinding' | 'voluntary' | 'proposed' | 'adopted' | 'rescinded'
    | 'generally_applicable' | 'market_wide' | 'provider_specific' | 'government_use'
    | 'procurement' | 'not_yet_applicable' | 'judicial' | 'administrative'
    | 'contractual' | 'oversight' | 'self_executing' | 'none_specified'
    | 'government_department' | 'federal_agency' | 'independent_agency' | 'advisory_body'
    | 'regulator' | 'standards_body' | 'research_body' | 'interagency_body'
    | 'organizational_unit' | 'supranational_institution' | 'standards_development'
    | 'measurement_science' | 'technical_guidance' | 'research' | 'evaluation'
    | 'coordination' | 'grant_administration' | 'procurement_support' | 'established'
    | 'partial' | 'institution_id' | 'institution_type' | 'mandate' | 'mission'
    | 'authority_sources' | 'authority_source_ids' | 'source_ids' | 'functions'
    | 'function' | 'operational_capacity' | 'status' | 'capacity_type'
    | 'capacity_components' | 'as_of_date' | 'quantity' | 'unit' | 'qualifier'
    | 'active' | 'planned' | 'limited' | 'degraded' | 'suspended' | 'retired'
    | 'laboratory_network' | 'facility' | 'program' | 'technical_capability'
    | 'accreditation_system' | 'partnership_network' | 'exact' | 'approximate'
    | 'minimum' | 'maximum' | 'dimensions' | 'evidence_refs' | 'decision_rights'
    | 'decision_right' | 'parent_institution_id' | 'subunit_ids'
    | 'oversight_relationships' | 'institutional_relationships' | 'relation'
    | 'relationship' | 'applicable_period' | 'from' | 'until' | 'part_of' | 'oversees'
    | 'supports' | 'advises' | 'coordinates_with' | 'reports_to' | 'implements_for'
    | 'target' | 'type' | 'value' | 'rationale' | 'reviewer' | 'family_context'
    | 'related_judgment_ids' | 'passage_selection' | 'record_family_classification'
    | 'subject_identification' | 'scope_interpretation' | 'topic_classification'
    | 'legal_status_determination' | 'institutional_role_determination'
    | 'operational_capacity_determination' | 'direct_or_inferred' | 'disagreement'
    | 'adjudication' | 'review_disposition' | 'record_link_disposition' | 'accepted'
    | 'fact_type' | 'identity' | 'placement' | 'record_link' | 'link_id' | 'source'
    | 'kind' | 'issued_by' | 'administered_by' | 'implemented_by' | 'enforced_by'
    | 'establishes' | 'assigns_function_to' | 'derives_authority_from' | 'applies_to'
    | 'supersedes_judgment_ids' | 'superseded_by_judgment_id' | 'supersedes';

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
terminal DATETIME: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[^;\s}]+/;
terminal DATE: /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
terminal NUMBER returns number: /[0-9]+(\.[0-9]+)?/;
terminal ID: /[_a-zA-Z][\w-]*/;
terminal STRING: /"(?:\\.|[^"\\])*"/;
