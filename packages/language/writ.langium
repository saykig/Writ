grammar Writ

// -----------------------------------------------------------------------------
// Writ 0.1 grammar.
//
// This grammar covers the full concrete surface exercised by the checked-in
// internal language and compatibility fixtures plus the design-target grammar in
// `protocols/language/writ.ebnf`. Where the protocol's §16
// `rule … => …` sugar diverges from the example files, the example files are the
// compile target, so the concrete syntax here follows them (`result "+1" priority
// 10 when … id …;`). References are kept as plain qualified-name strings; symbol
// linking and type checking run as a dedicated pass over the parsed AST so the
// grammar stays small and error recovery stays deterministic.
// -----------------------------------------------------------------------------

entry Model:
    'language' 'writ' languageVersion=STRING
    'package' packageName=QualifiedName 'version' packageVersion=STRING
    (';' | '{' imports+=Import* '}')
    declarations+=Declaration*;

Declaration:
      Import
    | Source
    | EnumDeclaration
    | ConceptDeclaration
    | SetDeclaration
    | RationaleDeclaration
    | Commitment
    | RecordDeclaration
    | JudgmentDeclaration
    | Profile
    | Scenario;

// --- Source-grounded records and judgments ---------------------------------

RecordDeclaration:
    'record' name=ID ':' family=RecordFamily '{'
        members+=RecordMember*
    '}';

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

RecordEvidence:
    'evidence' '{' references+=RecordEvidenceReference+ '}';
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

RecordUncertainty:
    'uncertainty' '{' items+=RecordUncertaintyItem* '}';
RecordUncertaintyItem: 'item' kind=UncertaintyType description=STRING ';';
UncertaintyType returns string: 'unknown' | 'contested' | 'ambiguous' | 'incomplete_evidence';

RecordProvenance:
    'provenance' '{'
        'created_by' createdBy=STRING ';'
        'created_at' createdAt=DATE ';'
    '}';
ReviewState returns string: 'draft' | 'reviewed' | 'approved' | 'superseded' | 'withdrawn';

LegalPolicyExtension:
    'legal_policy' '{' properties+=LegalPolicyProperty* '}';
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

InstitutionalExtension:
    'institutional' '{' properties+=InstitutionalProperty* '}';
InstitutionalProperty:
      {infer InstitutionIdProperty} 'institution_id' value=QualifiedName ';'
    | {infer InstitutionTypeProperty} 'institution_type' value=InstitutionType ';'
    | MandateProperty
    | MissionProperty
    | {infer AuthoritySourcesProperty} 'authority_sources' values=IdentifierList ';'
    | {infer InstitutionalJurisdictionsProperty} 'jurisdictions' values=StringList ';'
    | {infer FunctionsProperty} 'functions' values=FunctionList ';'
    | OperationalCapacityProperty
    | {infer DecisionRightsProperty} 'decision_rights' values=StringList ';'
    | {infer ParentInstitutionProperty} 'parent_institution_id' value=QualifiedName ';'
    | {infer SubunitIdsProperty} 'subunit_ids' values=IdentifierList ';'
    | OversightRelationshipsProperty
    | InstitutionalRelationshipsProperty
    | ApplicablePeriodProperty;

InstitutionType returns string: 'government_department' | 'federal_agency' | 'independent_agency' | 'advisory_body' | 'regulator' | 'standards_body' | 'research_body' | 'interagency_body' | 'organizational_unit' | 'other' | 'unknown';
InstitutionFunction returns string: 'standards_development' | 'measurement_science' | 'technical_guidance' | 'research' | 'evaluation' | 'coordination' | 'oversight' | 'grant_administration' | 'procurement_support' | 'other';
MandateProperty:
    'mandate' (
        '{'
            'status' status=MandateStatus ';'
            ('text' text=STRING ';')?
            ('authority_source_ids' authoritySourceIds=IdentifierList ';')?
            ('evidence_refs' evidenceRefs=IdentifierList ';')?
        '}'
        | legacyText=STRING ';'
    );
MandateStatus returns string: 'established' | 'unknown' | 'contested';
MissionProperty:
    'mission' '{'
        'text' text=STRING ';'
        ('source_ids' sourceIds=IdentifierList ';')?
        ('evidence_refs' evidenceRefs=IdentifierList ';')?
    '}';
OperationalCapacityProperty:
    'operational_capacity' '{'
        'status' status=CapacityStatus ';'
        'dimensions' dimensions=StringList ';'
        'evidence_refs' evidenceRefs=IdentifierList ';'
    '}';
CapacityStatus returns string: 'established' | 'partial' | 'unknown' | 'contested';
OversightRelationshipsProperty: 'oversight_relationships' relationships=RelationshipList ';';
InstitutionalRelationshipsProperty: 'institutional_relationships' relationships=RelationshipList ';';
RelationshipList: '{' relationships+=InstitutionalRelationship* '}';
InstitutionalRelationship: 'relation' type=InstitutionalRelationType target=QualifiedName ';';
InstitutionalRelationType returns string: 'part_of' | 'oversees' | 'supports' | 'advises' | 'coordinates_with' | 'reports_to' | 'implements_for';
ApplicablePeriodProperty: 'applicable_period' '{' ('from' from=DATE ';')? ('until' until=DATE ';')? '}';

JudgmentDeclaration:
    'judgment' name=ID '{' members+=JudgmentMember* '}';
JudgmentMember:
      {infer JudgmentTarget} 'target' value=QualifiedName ';'
    | {infer JudgmentTypeProperty} 'type' value=JudgmentType ';'
    | {infer JudgmentValue} 'value' value=Literal ';'
    | {infer JudgmentRationale} 'rationale' value=STRING ';'
    | {infer JudgmentEvidenceRefs} 'evidence_refs' values=IdentifierList ';'
    | {infer JudgmentReviewer} 'reviewer' value=STRING ';'
    | {infer JudgmentStatusProperty} 'status' value=JudgmentStatus ';'
    | {infer JudgmentCreatedAt} 'created_at' value=DATE ';'
    | {infer JudgmentFamilyContext} 'family_context' value=RecordFamily ';'
    | {infer JudgmentSupersedes} 'supersedes' value=QualifiedName ';'
    | {infer RelatedJudgments} 'related_judgment_ids' values=IdentifierList ';';
JudgmentType returns string: 'passage_selection' | 'record_family_classification' | 'subject_identification' | 'scope_interpretation' | 'topic_classification' | 'legal_status_determination' | 'institutional_role_determination' | 'operational_capacity_determination' | 'direct_or_inferred' | 'disagreement' | 'adjudication';
JudgmentStatus returns string: 'proposed' | 'accepted' | 'contested' | 'superseded';

IdentifierList: '{' (values+=QualifiedName (',' values+=QualifiedName)* ','?)? '}';
StringList: '{' values+=STRING (',' values+=STRING)* ','? '}' | {infer EmptyStringList} '{' '}';
TopicList: '{' values+=(QualifiedName | STRING) (',' values+=(QualifiedName | STRING))* ','? '}' | {infer EmptyTopicList} '{' '}';
FunctionList: '{' values+=InstitutionFunction (',' values+=InstitutionFunction)* ','? '}';

// --- Imports & sources ------------------------------------------------------

Import:
    'import' packageName=QualifiedName 'version' version=STRING
    ('hash' contentHash=STRING)? ';';

Source:
    'source' name=ID '{'
        properties+=SourceProperty*
    '}';

SourceProperty:
      {infer SourceUri} 'uri' value=STRING ';'
    | {infer SourceMediaType} 'media_type' value=STRING ';'
    | {infer SourceRetrieved} 'retrieved' value=DATETIME ';'
    | {infer SourceSha} 'sha256' value=STRING ';';

// --- Type / concept / set / rationale declarations --------------------------

EnumDeclaration:
    'enum' name=ID '{' values+=ID (',' values+=ID)* ','? '}';

ConceptDeclaration:
    'concept' name=ID (':' base=TypeRef)? '{'
        properties+=ConceptProperty*
    '}';

ConceptProperty:
    name=ID value=(STRING | NUMBER | DATE | QualifiedName) ';';

SetDeclaration:
    'set' name=ID ':' type=TypeRef '=' value=SetExpression ';';

RationaleDeclaration:
    'rationale' name=ID '{'
        'text' text=STRING ';'
    '}';

// --- Commitment -------------------------------------------------------------

Commitment:
    'commitment' name=ID '{'
        members+=CommitmentMember*
    '}';

CommitmentMember:
      Title
    | Summit
    | Authority
    | Adopted
    | Subjects
    | Window
    | IssueAreas
    | EvidencePolicy
    | UnknownPolicy
    | CommitmentText
    | Dimension
    | Goal
    | PartnerClass
    | Parameter
    | ActionIdentity
    | Predicate
    | Classification
    | Variable
    | Measure
    | ScoreBlock
    | Assertion;

Title: 'title' value=STRING ';';
Summit: 'summit' value=QualifiedName ';';
Authority: 'authority' 'cite' source=ID anchor=CitationAnchor ';';
Adopted: 'adopted' value=DATE ';';
Subjects: 'subjects' value=Expression ';';
Window:
    'evaluation_window' startBracket=('[' | '(') start=DATE ',' end=DATE endBracket=(']' | ')') ';';
IssueAreas: 'issue_areas' '{' areas+=ID (',' areas+=ID)* ','? '}' ';';
EvidencePolicy: 'evidence_policy' value=('open_world' | 'closed_world') ';';
UnknownPolicy:
    'unknown_policy' value=('propagate' | 'explicit_rules_only' | 'treat_false' | 'treat_true') ';';
CommitmentText: 'text' value=STRING ';';
Dimension: 'dimension' name=ID (description=STRING)? ';';
Goal: 'goal' name=ID (description=STRING)? ';';
PartnerClass: 'partner_class' name=ID (description=STRING)? ';';
Parameter:
    'parameter' name=ID ':' type=TypeRef '=' default=Literal
    ('allowed' allowed=SetExpression)? ';';
ActionIdentity:
    'action_identity' policy=IdentityPolicy 'by'
    keyPaths+=QualifiedName (',' keyPaths+=QualifiedName)* ';';

IdentityPolicy returns string:
    'review_required' | 'strict_deduplicate' | 'strict_separate' | 'propagate_uncertainty';

// --- Predicates & classifications -------------------------------------------

Predicate:
    'predicate' name=ID '(' (params+=PredicateParam (',' params+=PredicateParam)*)? ')'
    '->' returnType=TypeRef '{'
        rules+=DeriveRule*
    '}';

PredicateParam: name=ID ':' type=TypeRef;

DeriveRule:
    'derive' conclusion=TruthValue ('priority' priority=NUMBER)? 'when' when=Expression
    ('because' rationale=ID)? ';';

Classification:
    'classify' name=ID mode=('exclusive' | 'multi_label') '{'
        rules+=ClassificationRule*
        (otherwise=OtherwiseClass)?
    '}';

ClassificationRule:
    'label' label=ID 'priority' priority=NUMBER 'when' when=Expression
    ('because' rationale=ID)? ';';

OtherwiseClass:
    'otherwise' label=ID (safe?='safe_under_open_world')? ';';

// --- Variables --------------------------------------------------------------

Variable: 'let' name=ID ':' type=TypeRef '=' expression=Expression ';';

// --- Measures (weighted-ordinal graded indices) -----------------------------

Measure:
    'measure' name=ID '{'
        components+=MeasureComponent+
        'aggregate' strategy=AggregationStrategy 'scale' scale=NUMBER ';'
    '}';

MeasureComponent:
    'component' name=ID 'weight' weight=NUMBER ('cite' source=ID)? '{'
        anchors+=AnchorRule+
    '}';

AnchorRule:
    'anchor' value=NUMBER 'when' when=Expression
    ('because' rationale=ID)? ';';

AggregationStrategy returns string: 'weighted_ordinal_percent';

// --- Score ------------------------------------------------------------------

ScoreBlock:
    'score' '{'
        rules+=ScoreRule+
        otherwise=OtherwiseScore
    '}';

ScoreRule:
    'result' result=STRING 'priority' priority=NUMBER 'when' when=Expression
    ('id' name=NamePart)?
    (intentionalOverlap?='intentional_overlap')?
    ('because' rationale=ID)? ';';

OtherwiseScore:
    'otherwise' (resultKw=OtherwiseKw | resultValue=STRING) message=STRING ';';

OtherwiseKw returns string: 'unresolved' | 'not_applicable';

// --- Assertions -------------------------------------------------------------

Assertion:
    'assert' kind=AssertionKind
    ('over' domains+=Domain (',' domains+=Domain)*)?
    ('except' exceptions=Expression)? ';';

AssertionKind returns string:
    'exhaustive' | 'non_overlapping' | 'monotonic' | 'no_unanchored_claims'
    | 'all_score_inputs_reviewed';

Domain: variable=QualifiedName 'in' (range=Range | set=SetExpression);

Range: {infer Range} min=NUMBER '..' max=NUMBER;

// --- Interpretation profiles & scenarios ------------------------------------

Profile:
    'profile' name=ID 'for' commitment=QualifiedName '{'
        members+=ProfileMember*
    '}';

ProfileMember:
      {infer ProfileSet} 'set' path=QualifiedName '=' value=Literal ';'
    | {infer ProfileWaive} 'waive' diagnostic=ID 'because' reason=STRING ';';

Scenario:
    'scenario' name=ID 'for' commitment=QualifiedName '{'
        givens+=Given*
        expect=Expect
    '}';

Given: 'given' path=QualifiedName '=' value=Literal ';';

Expect:
    'expect' ('result' result=STRING | 'diagnostic' diagnostic=ID) ';';

// --- Citations --------------------------------------------------------------

CitationAnchor:
      {infer PageAnchor} 'page' page=NUMBER
    | {infer PagesAnchor} 'pages' from=NUMBER '..' to=NUMBER
    | {infer LinesAnchor} 'lines' from=NUMBER '..' to=NUMBER
    | {infer QuoteAnchor} 'quote' quote=STRING
    | {infer DomAnchor} 'dom' selector=STRING
    | {infer JsonPointerAnchor} 'json_pointer' pointer=STRING;

// --- Expressions (precedence: or → and → not → compare → add → postfix) ------

type Expression =
      BinaryExpression | UnaryExpression | ReferenceExpression | QueryExpression
    | CallExpression | SetLiteral | StringLiteral | NumberLiteral | BooleanLiteral
    | TruthLiteral | DateLiteral;

Expression returns Expression:
    OrExpression;

OrExpression returns Expression:
    AndExpression ({infer BinaryExpression.left=current} op='or' right=AndExpression)*;

AndExpression returns Expression:
    NotExpression ({infer BinaryExpression.left=current} op='and' right=NotExpression)*;

NotExpression returns Expression:
      {infer UnaryExpression} op='not' operand=CompareExpression
    | CompareExpression;

CompareExpression returns Expression:
    AdditiveExpression
    ({infer BinaryExpression.left=current} op=CompareOp right=AdditiveExpression)?;

CompareOp returns string:
    '==' | '!=' | '>=' | '>' | '<=' | '<' | 'in' | 'between'
    | 'overlaps' | 'before' | 'after' | 'contains';

AdditiveExpression returns Expression:
    PostfixExpression
    ({infer BinaryExpression.left=current} op=('+' | '-') right=PostfixExpression)*;

PostfixExpression returns Expression:
    Primary ({infer UnaryExpression.operand=current} op=('nonempty' | 'is_known' | 'is_contested'))*;

Primary returns Expression:
      Query
    | Call
    | Literal
    | SetExpression
    | {infer ReferenceExpression} path=QualifiedName
    | '(' Expression ')';

Query returns Expression:
    {infer QueryExpression} op=QueryOp '(' collection=QualifiedName
    ('where' where=Expression)?
    ('distinct_by' distinctBy=QualifiedName)?
    ('select' select=Expression)?
    (',' extraArgs+=Expression (',' extraArgs+=Expression)*)?
    ')';

QueryOp returns string:
    'count_distinct' | 'count' | 'exists' | 'forall' | 'sum' | 'ratio'
    | 'coverage' | 'min' | 'max';

Call returns Expression:
    {infer CallExpression} func=QualifiedName '(' (args+=Expression (',' args+=Expression)*)? ')';

SetExpression returns Expression:
    {infer SetLiteral} '{' (elements+=Expression (',' elements+=Expression)*)? ','? '}';

Literal returns Expression:
      {infer StringLiteral} value=STRING
    | {infer NumberLiteral} value=NUMBER
    | {infer BooleanLiteral} value=('true' | 'false')
    | {infer TruthLiteral} value=('unknown' | 'contested')
    | {infer DateLiteral} value=DATE;

TruthValue returns string: 'true' | 'false' | 'unknown' | 'contested';

// --- Datatype rules ---------------------------------------------------------

// `id` is also a score-rule keyword; allow it as a name segment so field paths
// like `action.id` and identity key paths like `by id` still parse.
QualifiedName returns string: NamePart ('.' NamePart)*;

NamePart returns string:
    ID | 'id' | 'writ' | 'record' | 'judgment' | 'legal_policy' | 'institutional'
    | 'corpus' | 'version' | 'title' | 'subjects' | 'assertion' | 'topics' | 'scope'
    | 'evidence' | 'uncertainty' | 'provenance' | 'review_state' | 'support'
    | 'document_version' | 'passage' | 'locator' | 'quote' | 'passage_hash'
    | 'document_hash' | 'basis' | 'direct' | 'inferred' | 'inherited'
    | 'unknown' | 'contested' | 'ambiguous' | 'incomplete_evidence'
    | 'draft' | 'reviewed' | 'approved' | 'superseded' | 'withdrawn'
    | 'requires' | 'permits' | 'prohibits' | 'defines' | 'authorizes' | 'assigns'
    | 'performs' | 'states' | 'observes' | 'jurisdiction' | 'condition' | 'conditions'
    | 'institutional_scope' | 'temporal_scope' | 'subject' | 'label' | 'role' | 'item'
    | 'created_by' | 'created_at' | 'instrument_type' | 'jurisdiction_level'
    | 'force' | 'adoption_status' | 'applicability_status' | 'enforcement_status'
    | 'official_citation' | 'provision_identifier' | 'jurisdictions'
    | 'responsible_authorities' | 'effective_from' | 'effective_until' | 'exceptions'
    | 'compliance_pathway' | 'parent_instrument_id' | 'related_provision_ids'
    | 'source_metadata' | 'dataset_name' | 'dataset_snapshot' | 'source_row_identifier'
    | 'source_url' | 'chapter' | 'section_number' | 'section_title' | 'original_text'
    | 'last_amended_year' | 'row_hash'
    | 'constitution' | 'constitutional_amendment' | 'statute' | 'regulation'
    | 'executive_order' | 'agency_policy' | 'guidance' | 'code' | 'other'
    | 'federal' | 'state' | 'territorial' | 'district' | 'institution_specific'
    | 'binding' | 'nonbinding' | 'voluntary' | 'proposed' | 'adopted' | 'rescinded'
    | 'generally_applicable' | 'market_wide' | 'provider_specific' | 'government_use'
    | 'procurement' | 'not_yet_applicable' | 'judicial' | 'administrative'
    | 'contractual' | 'oversight' | 'self_executing' | 'none_specified'
    | 'government_department' | 'federal_agency' | 'independent_agency' | 'advisory_body'
    | 'regulator' | 'standards_body' | 'research_body' | 'interagency_body'
    | 'organizational_unit' | 'standards_development' | 'measurement_science'
    | 'technical_guidance' | 'research' | 'evaluation' | 'coordination'
    | 'grant_administration' | 'procurement_support' | 'established' | 'partial'
    | 'institution_id' | 'institution_type' | 'mandate' | 'mission' | 'authority_sources'
    | 'authority_source_ids' | 'source_ids'
    | 'functions' | 'operational_capacity' | 'status' | 'dimensions' | 'evidence_refs'
    | 'decision_rights' | 'parent_institution_id' | 'subunit_ids'
    | 'oversight_relationships' | 'institutional_relationships' | 'relation'
    | 'applicable_period' | 'from' | 'until' | 'part_of' | 'oversees' | 'supports'
    | 'advises' | 'coordinates_with' | 'reports_to' | 'implements_for'
    | 'target' | 'type' | 'value' | 'rationale' | 'reviewer' | 'family_context'
    | 'related_judgment_ids' | 'passage_selection' | 'record_family_classification'
    | 'subject_identification' | 'scope_interpretation' | 'topic_classification'
    | 'legal_status_determination' | 'institutional_role_determination'
    | 'operational_capacity_determination' | 'direct_or_inferred' | 'disagreement'
    | 'adjudication' | 'accepted';

TypeRef returns string: QualifiedName ('<' TypeRef (',' TypeRef)* '>')?;

// --- Terminals --------------------------------------------------------------

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

terminal DATETIME: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[^;\s}]+/;
terminal DATE: /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
terminal NUMBER returns number: /[0-9]+(\.[0-9]+)?/;
terminal ID: /[_a-zA-Z][\w-]*/;
terminal STRING: /"(?:\\.|[^"\\])*"/;
