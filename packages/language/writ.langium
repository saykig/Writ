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
    | Profile
    | Scenario;

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
    ('id' name=ID)?
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

NamePart returns string: ID | 'id';

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
