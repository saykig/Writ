grammar Covenant

entry Model:
    'language' 'covenant' languageVersion=STRING
    'package' packageName=QualifiedName 'version' packageVersion=STRING ';'
    declarations+=Declaration*;

Declaration:
    Import | Source | EnumDeclaration | Commitment;

Import:
    'import' packageName=QualifiedName 'version' version=STRING
    ('hash' contentHash=STRING)? ';';

Source:
    'source' name=ID '{'
        ('uri' uri=STRING ';')
        ('media_type' mediaType=STRING ';')?
        ('retrieved' retrieved=DATETIME ';')?
        ('sha256' sha256=STRING ';')?
    '}';

EnumDeclaration:
    'enum' name=ID '{' values+=ID (',' values+=ID)* ','? '}';

Commitment:
    'commitment' name=ID '{'
        members+=CommitmentMember*
    '}';

CommitmentMember:
      TitleMember | SummitMember | AdoptedMember | WindowMember
    | EvidencePolicyMember | UnknownPolicyMember | ScoreBlock;

TitleMember: 'title' value=STRING ';';
SummitMember: 'summit' value=QualifiedName ';';
AdoptedMember: 'adopted' value=DATE ';';
WindowMember: 'evaluation_window' left=('[' | '(') start=DATE ',' end=DATE right=(']' | ')') ';';
EvidencePolicyMember: 'evidence_policy' value=('open_world' | 'closed_world') ';';
UnknownPolicyMember: 'unknown_policy' value=('propagate' | 'explicit_rules_only' | 'treat_false' | 'treat_true') ';';

ScoreBlock:
    'score' '{' rules+=ScoreRule+ otherwise=OtherwiseScore '}';
ScoreRule:
    'result' result=ScoreValue 'priority' priority=INT 'when' condition=Expression
    ('id' name=ID)? ('intentional_overlap' intentionalOverlap?='intentional_overlap')? ';';
OtherwiseScore:
    'otherwise' result=(ScoreValue | 'unresolved' | 'not_applicable') message=STRING ';';

Expression returns Expression:
    OrExpression;
OrExpression returns Expression:
    AndExpression ({infer BinaryExpression.left=current} op='or' right=AndExpression)*;
AndExpression returns Expression:
    Comparison ({infer BinaryExpression.left=current} op='and' right=Comparison)*;
Comparison returns Expression:
    Primary ({infer BinaryExpression.left=current} op=('=='|'!='|'>'|'>='|'<'|'<='|'between') right=Primary)?;
Primary returns Expression:
      {LiteralExpression} value=Literal
    | {ReferenceExpression} path=QualifiedName
    | '(' Expression ')';

Literal: STRING | INT | DATE | 'true' | 'false' | 'unknown' | 'contested';
ScoreValue: '-1' | '0' | '+1';
QualifiedName returns string: ID ('.' ID)*;
terminal DATE: /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
terminal DATETIME: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[^;\s}]+/;
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_-]*/;
terminal INT returns number: /-?[0-9]+/;
terminal STRING: /"(?:\\.|[^"\\])*"/;
