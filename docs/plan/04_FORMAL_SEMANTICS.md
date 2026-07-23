# Formal Semantics

## 1. Semantic boundary

The evaluator is a total, deterministic function over frozen inputs:

```text
Evaluate(
  compiled_methodology_bundle,
  evidence_snapshot,
  subject,
  interpretation_profile,
  as_of,
  cutoff,
  evaluator_build
) -> evaluation_receipt
```

It performs no network access, model inference, wall-clock reads, random generation, or database mutation.

## 2. Four-valued truth

Covenant uses a Belnap-style representation:

```text
true       = support for truth, no support for falsity       = (1, 0)
false      = no support for truth, support for falsity       = (0, 1)
unknown    = no support for truth or falsity                 = (0, 0)
contested  = support for both truth and falsity              = (1, 1)
```

The representation distinguishes lack of evidence from conflicting evidence.

### 2.1 Negation

```text
not (t, f) = (f, t)
```

Therefore:

```text
not true = false
not false = true
not unknown = unknown
not contested = contested
```

### 2.2 Conjunction

For `a and b`:

```text
truth_support  = a.truth_support AND b.truth_support
false_support  = a.false_support OR  b.false_support
```

Truth table:

| and | true | false | unknown | contested |
|---|---:|---:|---:|---:|
| true | true | false | unknown | contested |
| false | false | false | false | false |
| unknown | unknown | false | unknown | false |
| contested | contested | false | false | contested |

### 2.3 Disjunction

For `a or b`:

```text
truth_support  = a.truth_support OR  b.truth_support
false_support  = a.false_support AND b.false_support
```

Truth table:

| or | true | false | unknown | contested |
|---|---:|---:|---:|---:|
| true | true | true | true | true |
| false | true | false | unknown | contested |
| unknown | true | unknown | unknown | true |
| contested | true | contested | true | contested |

### 2.4 Equality and comparisons

A comparison over known, uncontested values returns `true` or `false`.

It returns `unknown` when an operand is absent or its derivation is unknown.

It returns `contested` when accepted evidence supports incompatible operand values and no interpretation resolves them.

### 2.5 Quantifiers

For a finite set:

```text
forall x in S: P(x) = conjunction of P(x)
exists x in S: P(x) = disjunction of P(x)
```

For an empty set:

```text
forall = true
exists = false
```

The language should provide `nonempty` when vacuous truth is not intended.

## 3. Evidence inclusion

Only claims visible in the frozen evidence snapshot are considered.

By default, a claim is score-eligible when:

```text
claim.status == accepted
claim.recorded_time <= cutoff
claim.valid_time is relevant under the methodology
all required reviews are satisfied
```

Candidate, rejected, withdrawn, and superseded claims do not support a score. Accepted contested claims can contribute contested truth.

## 4. Open-world semantics

A predicate with no supporting evidence is `unknown` unless:

- the predicate is derived from a complete enumerated domain;
- an explicit negative claim is accepted;
- a methodology declares a closed-world subdomain;
- a reviewed negative-search protocol satisfies a declared completeness requirement.

Example:

```text
closed_world implementation_stage for action when
  official_program_record_complete(action);
```

Closed-world declarations are local and source-linked. There is no global closed-world assumption.

## 5. Derivation rules

A predicate may have multiple supporting and contradicting rule instances.

For each ground predicate:

```text
truth_support = OR of rule instances concluding true
false_support = OR of rule instances concluding false
```

If both are supported, the result is `contested`.

A proof node records:

```text
predicate
arguments
truth_value
rule_instances[]
evidence_claim_ids[]
child_nodes[]
```

## 6. Classification semantics

A classification block evaluates each label rule for an action.

### 6.1 Exclusive classification

Default behavior:

1. Evaluate all label predicates.
2. Select labels whose predicate is `true`.
3. If one label has uniquely highest priority, select it.
4. If multiple labels share highest priority, classification is unresolved and an ambiguity diagnostic is emitted.
5. If no label is true but a potentially decisive label is `contested`, classification is contested.
6. If no label is true and one or more are unknown, use the declared `otherwise` label only if it is explicitly safe under open-world semantics. Otherwise return unclassified with unknown status.

A lower-priority true label is still recorded in the proof tree.

### 6.2 Multi-label classification

A block declared `multi_label` returns the set of all true labels and preserves unknown or contested labels separately.

## 7. Counting semantics

A count is defined over a query and identity key.

```text
count(distinct actions where strong(action) by methodology_identity)
```

An action contributes to a definite count only when membership is true.

For uncertain membership, the engine computes an interval:

```text
minimum_count = definitely included distinct identities
maximum_count = definitely or possibly included distinct identities
```

A comparison against a threshold is:

- `true` when the whole interval satisfies it;
- `false` when the whole interval violates it;
- `unknown` when the interval crosses the threshold due to unknown membership;
- `contested` when conflicting accepted evidence creates incompatible identity or classification states.

Receipts should expose the count interval, not only a truth value.

## 8. Distinct identity semantics

Identity expressions return a stable key. Unknown identity creates a possible-duplicate group.

When two actions may be the same count unit:

- under `strict_deduplicate`, count the group once unless distinctness is proven;
- under `strict_separate`, count separately unless duplication is proven;
- under `propagate_uncertainty`, compute lower and upper count bounds;
- under `review_required`, block publication until adjudicated.

The default production profile should use `review_required` for score-decisive possible duplicates.

## 9. Temporal semantics

Every temporal predicate specifies which time axis it uses:

```text
announcement_time
legal_effect_time
implementation_time
disbursement_time
valid_time
recorded_time
```

`overlaps` follows interval algebra. Date-only values are interpreted in the source jurisdiction's calendar but normalized to ISO dates. A date has no implicit local time.

The evaluation cutoff limits knowledge state. The evaluation window limits qualifying world events. They are not interchangeable.

## 10. Money and quantities

Use exact decimal values.

Comparison requires compatible units. Currency comparison is valid only when:

- currencies match; or
- the methodology calls an explicit conversion function with a pinned rate source and date.

Bounds are preserved:

```text
up_to CAD 300M -> interval [0, 300M]
at_least USD 50M -> interval [50M, +infinity)
approximately EUR 10M -> configured uncertainty interval
```

A threshold comparison uses interval logic and can return unknown.

## 11. Coverage semantics

Coverage is the cardinality or proportion of declared elements for which a predicate is true.

```text
coverage(partner_classes, covered)
```

The denominator is the declared versioned set. Unknown or contested membership produces minimum and maximum coverage.

A rule requiring five partner classes is true only when minimum coverage is at least five.

## 12. Score branch semantics

A score program contains ordered or prioritized branches:

```text
rule_id
priority
result
condition
```

Evaluation procedure:

1. Evaluate every condition to a truth value and proof node.
2. Collect branches whose condition is `true`.
3. If there is exactly one branch at the highest priority, select it.
4. If multiple highest-priority true branches produce the same result, select that result but emit an overlap warning unless overlap was declared intentional.
5. If multiple highest-priority true branches produce different results, return `unresolved` with `AMBIGUOUS_SCORE`.
6. If no branch is true:
   - inspect unknown and contested branches;
   - if one or more could change the result, return `unresolved` with the decisive uncertainty set;
   - otherwise apply an explicit `otherwise` branch.
7. Never choose a lower score merely because higher branches are unknown.

## 13. Score result and result status

The receipt separates value and epistemic status:

```text
result: +1 | 0 | -1 | not_applicable | unresolved
result_status: supported | contested | incomplete | ambiguous | invalid
```

A score can be `+1` and `contested` only if a publication policy permits a scalar result despite contestation. The default final-publication policy should require `supported`.

## 14. Confidence

Confidence is metadata calculated from declared factors, for example:

```text
source quality
corroboration
review agreement
passage directness
identity certainty
translation certainty
```

Confidence must not be used as an undeclared score weight. It is not a probability unless a formal probabilistic model is adopted.

## 15. Interpretation parameters

A methodology declares permitted parameters and their types:

```text
parameter minimum_stage: ImplementationStage default funded;
parameter collective_actions: CollectivePolicy default review_required;
```

A profile supplies values. The compiled bundle contains the parameter schema. Unknown parameters or type mismatches are errors.

Changing a profile creates a distinct evaluation run and receipt.

## 16. Canonicalization and hashes

Before hashing:

- validate against the versioned JSON Schema;
- normalize Unicode to NFC where permitted;
- serialize exact decimals as canonical strings;
- sort object keys using RFC 8785-compatible canonical JSON;
- preserve ordered lists where order is semantically meaningful;
- exclude transport-only fields declared non-semantic.

Hashes:

```text
methodology_bundle_hash
evidence_snapshot_hash
interpretation_profile_hash
evaluator_build_hash
receipt_hash
release_manifest_hash
```

## 17. Deterministic report prose

Narrative generation is not the scoring authority.

A deterministic report template should first generate a factual skeleton from the receipt:

```text
result
matched rule
qualifying actions
excluded actions
unresolved issues
source citations
```

A language model may improve prose only after the skeleton is fixed. Generated wording must not introduce new facts or reasoning. Model name, prompt template version, and output review are recorded.

## 18. Publication policy

A publication policy can require:

```text
all score-decisive claims accepted
no blocking diagnostics
no unresolved possible duplicates
minimum source tier or corroboration
reviewer quorum
receipt signature
```

Publication policy is separate from methodology. A methodologically valid score may still be operationally unpublishable.

## 19. Semantic conformance tests

Every evaluator implementation must pass a shared conformance suite covering:

- all four truth values and operators;
- unknown threshold intervals;
- contested identity;
- priority and overlap;
- empty quantifiers;
- temporal boundaries;
- quantity bounds;
- coverage bounds;
- source cutoff behavior;
- deterministic canonical hashes.
