# Covenant Language Specification

Status: proposed language version `0.1`.

## 1. Design goals

The language should be readable by policy researchers, reviewable by engineers, and compilable into a stable canonical IR.

It must support:

- literate source alignment;
- stable identifiers and imports;
- typed concepts and quantities;
- commitment identification and evaluation;
- four-valued predicates;
- reusable classifications;
- temporal and attribution policies;
- score rules and precedence;
- assertions, examples, and test scenarios;
- deterministic lowering to IR.

It should not expose implementation details such as SQL or model prompts.

## 2. File forms

### 2.1 Plain source

Extension: `.covenant`

Contains only Covenant syntax.

### 2.2 Literate source

Extension: `.covenant.md`

Markdown prose is documentation. Fenced blocks labelled `covenant` are compiled in document order.

````markdown
The report defines a strong action as an implemented measure directly targeting SMEs.

```covenant
classify action as strong when ...;
```
````

A literate compiler preserves the Markdown heading path and nearby source anchors in debug metadata.

## 3. Package header

```text
language covenant "0.1"

package g7.kananaskis_2025.ai_sme version "1.0.0" {
  import covenant.std.g7 version "1.0.0";
  import covenant.std.evidence version "1.0.0";
}
```

Package names are globally unique within a registry. Imports are pinned by semantic version and resolved to content hashes in a lock file.

## 4. Source declarations

```text
source coding_manual {
  uri "https://www.g7.utoronto.ca/compliance/Compliance_Coding_Manual_2020.pdf";
  media_type "application/pdf";
  retrieved 2026-07-22T00:00:00Z;
  sha256 "sha256:...";
}

source ai_chapter {
  uri "https://www.g7.utoronto.ca/evaluations/2025compliance-final/04-2025-G7-final-compliance-ai.pdf";
  media_type "application/pdf";
  sha256 "sha256:...";
}
```

Source hashes may be omitted while authoring but are mandatory for a published methodology bundle.

## 5. Citations and rationale

```text
cite ai_chapter page 2 lines 135..192;

rationale action_maturity {
  text "An announcement without authorization or funding is treated as weak.";
  support cite ai_chapter page 2 lines 165..192;
}
```

Supported anchor forms:

```text
page N
pages N..M
lines A..B
bbox(page, x0, y0, x1, y1)
dom "CSS or XPath"
json_pointer "/results/0/title"
quote "short exact passage"
```

Published bundles resolve all citations to immutable passage identifiers.

## 6. Standard types

```text
Bool
Truth
Int
Decimal
Text
Date
DateTime
Interval<T>
Money<Currency>
Quantity<Unit>
Percent
URI
Hash
Set<T>
List<T>
Map<K,V>
Optional<T>
```

Domain reference types include:

```text
Institution
Jurisdiction
Summit
Document
Commitment
Subject
Action
Instrument
Program
Beneficiary
PartnerClass
Dimension
Goal
Source
Passage
Claim
Review
```

`Truth` values are `true`, `false`, `unknown`, and `contested`.

## 7. Enumerations and concepts

```text
enum ImplementationStage {
  proposed,
  announced,
  authorized,
  budgeted,
  funded,
  contracted,
  launched,
  operational,
  disbursing,
  evaluated,
  completed,
  suspended,
  repealed
}

enum BeneficiaryTargeting {
  explicit,
  materially_inclusive,
  indirect,
  general,
  absent,
  contested
}
```

Concepts may be simple aliases or source-linked definitions:

```text
concept sustain: Text {
  definition "continuation of support over the relevant period";
  support cite ai_chapter page 2;
}
```

## 8. Institution and subject sets

```text
institution Canada kind country;
institution EuropeanUnion kind supranational;

set G7Members: Set<Institution> = {
  Canada,
  France,
  Germany,
  Italy,
  Japan,
  UnitedKingdom,
  UnitedStates,
  EuropeanUnion
};
```

Historical membership must be time-aware in standard packages.

## 9. Commitment candidates

```text
candidate commitment c_2025_ai_sme {
  summit Kananaskis2025;
  source cite leaders_statement page 1;
  text "Sustain investments in AI adoption programs for SMEs...";

  identify {
    discrete true because "The clause expresses one separable obligation.";
    specific true because "It names investment, programs, SMEs, compute, and infrastructure.";
    politically_binding true because verb sustain level high;
    future_oriented true;
    collective_intent true;
  }
}
```

The compiler can validate completeness, but identification remains a reviewed decision.

## 10. Commitment declaration

```text
commitment AI_SME_ADOPTION {
  title "AI adoption programs for SMEs";
  summit Kananaskis2025;
  authority cite leaders_statement page 1;
  adopted 2025-06-17;
  subjects G7Members;
  evaluation_window [2025-06-18, 2026-06-01];
  issue_areas { artificial_intelligence, digital_economy };
  evidence_policy open_world;
  unknown_policy propagate;

  text """
  Sustain investments in AI adoption programs for SMEs, including support for
  access to compute and digital infrastructure.
  """;
}
```

## 11. Dimensions, goals, and partner classes

```text
dimension market_support;
dimension traceability;
dimension roadmap;

goal resilient_supply;
goal environmental_performance;

partner_class producer_country;
partner_class emerging_market;
partner_class development_finance_institution;
```

Declarations can contain metadata and source-linked definitions.

## 12. Predicates

Core predicates are typed and return `Truth`.

```text
predicate directly_targets(action: Action, beneficiary: Beneficiary): Truth;
predicate countable(action: Action): Truth;
predicate strong(action: Action): Truth;
predicate weak(action: Action): Truth;
predicate counter(action: Action): Truth;
```

Rules derive predicates:

```text
derive directly_targets(a, SME) when
  a.beneficiary_targeting == explicit;

derive countable(a) when all {
  a.actor in subjects;
  a.valid_time overlaps evaluation_window;
  a.status == accepted;
};
```

Rules are declarative. They cannot perform network access, mutate state, or call a language model.

## 13. Classification sugar

The common classification form lowers to predicates and an exclusive selection policy.

```text
classify action {
  counter priority 100 when action.effect obstructs commitment.objective;

  strong priority 50 when all {
    countable(action);
    directly_targets(action, SME);
    action.implementation_stage in {
      funded, contracted, launched, operational, disbursing
    };
    action.kind in {
      adoption_funding,
      compute_subsidy,
      implementation_toolkit,
      infrastructure_program,
      enabling_legislation
    };
  };

  weak priority 10 when any {
    action.kind in { verbal_support, conference, awareness_event };
    action.beneficiary_targeting in { indirect, general };
    action.implementation_stage in { proposed, announced };
  };

  otherwise unclassified;
}
```

Unless `multi_label` is declared, equal-priority overlapping labels are a blocking diagnostic.

## 14. Variables and queries

```text
let strong_actions = distinct actions
  where classify(action) == strong
  by action.methodology_identity;

let strong_count: Int = count(strong_actions);
let weak_count: Int = count(distinct actions where classify(action) == weak);
let counter_exists: Truth = exists action where classify(action) == counter;
```

Supported query operations:

```text
where
select
distinct ... by
group ... by
count
sum
min
max
ratio
coverage
exists
forall
```

Queries are finite over the frozen evaluation input.

## 15. Action identity

```text
identity action.methodology_identity by first_non_null {
  action.underlying_instrument_id,
  action.program_family_id,
  action.id
};
```

Alternative policies:

```text
identity by action.id;
identity by action.implementation_step_id;
identity custom predicate same_count_unit(a, b);
```

A score that counts actions without an identity policy produces a warning unless the imported standard declares one.

## 16. Score blocks

```text
score {
  rule countervailing priority 100 => -1 when counter_exists;
  rule full priority 50 => +1 when strong_count >= 5;
  rule partial_strong priority 30 => 0 when strong_count between 1 and 4;
  rule partial_weak priority 20 => 0 when all {
    strong_count == 0;
    weak_count >= 3;
  };
  rule none priority 10 => -1 when all {
    strong_count == 0;
    weak_count <= 2;
  };

  otherwise unresolved "No score rule has a supported unique result.";
}
```

Evaluation semantics are defined in `04_FORMAL_SEMANTICS.md`.

## 17. Multi-dimensional scoring

```text
assessment humanitarian_assistance {
  derive strong when ...;
  derive weak when ...;
}

assessment diplomatic_action {
  derive strong when ...;
  derive weak when ...;
}

score {
  rule full => +1 when all {
    humanitarian_assistance == strong;
    diplomatic_action == strong;
  };

  rule partial => 0 when any {
    set { humanitarian_assistance, diplomatic_action } == { strong, weak };
    all {
      humanitarian_assistance == weak;
      diplomatic_action == weak;
    };
  };

  rule none => -1 when any {
    humanitarian_assistance == none;
    diplomatic_action == none;
    counter_exists;
  };
}
```

## 18. Coverage scoring

```text
let covered_dimensions = coverage(
  dimensions,
  by dimension where exists action where strong(action, dimension)
);

let covered_partner_classes = coverage(
  partner_classes,
  by partner_class where exists action where strong(action, partner_class)
);

score {
  rule full => +1 when all {
    strong_count >= 6;
    covered_dimensions == 3;
    covered_partner_classes >= 5;
    roadmap.complete == true;
  };
}
```

## 19. Artifact completeness

```text
artifact roadmap {
  field objective required;
  field action_plan required;
  field responsible_body required;
  field timeline required;
  field consultation required;

  complete when all required_fields present and accepted;
}
```

## 20. Temporal rules

```text
derive in_scope(a) when all {
  a.valid_time overlaps evaluation_window;
  a.actor in subjects;
};

derive implemented(a) when
  a.implementation_stage >= funded;

derive reversible_credit(a) when all {
  a.announcement_time before evaluation_window.start;
  a.implementation_stage changed_during evaluation_window;
};
```

Stage ordering is explicit in an imported ontology. It must not be inferred from enum declaration order.

## 21. Source and evidence policies

```text
source_policy default_g7 {
  prefer tier <= 2;
  permit tier 3;
  permit tier 4 only when corroborated or no higher-tier source exists;
  tier 6 leads_only;
  require original_language_source when available;
  negative_claim requires search_protocol;
}
```

Source policy violations are diagnostics or review blockers, not hidden evaluator behavior.

## 22. Interpretation profiles

```text
interpretation strict_implementation version "1.0.0" {
  parameter minimum_stage = funded;
  parameter announced_programs_count = false;
  parameter collective_actions = exclude;
  parameter counteraction_precedence = explicit_only;
}

interpretation inclusive_commitment version "1.0.0" {
  extends strict_implementation;
  parameter announced_programs_count = true when authorization_confirmed;
  parameter collective_actions = count_when_member_endorsed;
}
```

Profiles can only set parameters declared by the methodology or imported standard. They cannot inject arbitrary executable code.

## 23. Assertions

```text
assert score.exhaustive over {
  strong_count in 0..20;
  weak_count in 0..20;
  counter_exists in { true, false };
};

assert score.non_overlapping except priority;
assert score.monotonic increasing strong_count unless counter_exists;
assert all_score_inputs review_status == accepted;
assert no_unanchored_claims;
```

Assertions may be statically proven, bounded-model checked, or evaluated at runtime. The output states which method was used.

## 24. Scenarios and tests

```text
scenario canada_full {
  given strong_count = 7;
  given weak_count = 2;
  given counter_exists = false;
  expect score == +1;
}

scenario uncovered_literal_rule {
  given strong_count = 0;
  given weak_count = 5;
  given counter_exists = false;
  expect diagnostic RULE_NOT_EXHAUSTIVE;
}
```

Scenarios compile into test fixtures and should run in CI.

## 25. Escape hatches

The first production release should not allow arbitrary JavaScript or Python inside a methodology package.

A controlled extension mechanism may later permit a versioned pure function implemented in WebAssembly, but only if:

- input and output schemas are declared;
- execution is deterministic and resource-bounded;
- the module is content-addressed;
- source is available;
- a pure DSL equivalent is not practical;
- a methodologist explicitly approves it.

The 2025 benchmark should aim for zero custom extensions.

## 26. Compiler output

A compiled bundle contains:

```text
language_version
package_id
package_version
content_hash
resolved_imports
symbol_table
normalized_types
normalized_predicates
normalized_rules
score_program
source_anchors
assertions
static_diagnostics
source_map
```

The evaluator accepts only a valid compiled bundle, not raw DSL text.

## 27. Version compatibility

- Patch methodology release: non-semantic documentation or source metadata correction.
- Minor methodology release: backward-compatible additions that do not alter existing evaluation results under identical input.
- Major methodology release: any change that can alter classification or score.
- Language and IR versions follow independent semantic versioning.

A release manifest pins all versions and hashes.
