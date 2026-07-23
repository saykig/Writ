# Static Analysis and Methodology QA

## 1. Purpose

The compiler must challenge the methodology before analysts apply it. Static analysis is one of the strongest reasons to build a DSL.

The analyzer operates at three levels:

1. Syntax and type validation.
2. Semantic linting over the methodology graph.
3. Bounded formal analysis over declared variable domains.

## 2. Diagnostic severity

```text
error    compilation or publication cannot proceed
warning  result may be valid, but methodologist review is required
info     quality or maintainability suggestion
```

A waiver is a signed, versioned decision with a rationale and scope. It is not a hidden configuration flag.

## 3. Required diagnostics

### WRT-SYN-001 Invalid syntax

The parser cannot construct an AST.

### WRT-NAME-001 Unresolved symbol

A commitment, dimension, goal, source, parameter, or predicate is referenced but not declared or imported.

### WRT-TYPE-001 Type mismatch

Examples:

- comparing money to an integer;
- using a set where a truth value is expected;
- comparing incompatible units;
- using a date where a date-time is required without an explicit conversion.

### WRT-TIME-001 Ambiguous time axis

A rule uses `date` without declaring announcement, validity, legal effect, implementation, or recorded time.

### WRT-EVID-001 Closed-world assumption not declared

A rule concludes false from lack of evidence in an open-world domain.

### WRT-EVID-002 Negative claim lacks search protocol

A score depends on absence, but no accepted negative-search record defines sources, terms, date range, and completeness standard.

### WRT-SCORE-001 Non-exhaustive score table

A declared analysis domain contains an assignment for which no score branch is definitely true and no explicit unresolved branch covers it.

AI-for-SMEs ambiguity fixture: if “up to four strong actions” is normalized as one through four, zero strong actions with five or more weak actions produces a gap. If it is normalized arithmetically as zero through four, zero strong actions with two or fewer weak actions overlaps the non-compliance branch. The analyzer must surface both consequences rather than silently choosing one.

### WRT-SCORE-002 Overlapping score branches

Two score rules can both be true for the same assignment.

The diagnostic states whether the results agree and whether priority resolves the overlap.

Known benchmark fixture: a counteraction and five strong actions can satisfy both non-compliance and full-compliance rules unless precedence is explicit.

### WRT-SCORE-003 Unreachable score branch

No assignment in the declared domain can satisfy a branch, often because a higher-priority rule subsumes it or the condition is contradictory.

### WRT-SCORE-004 Missing unknown policy

A score depends on a predicate that can be unknown or contested, but the methodology has no explicit propagation or resolution policy.

### WRT-SCORE-005 Ambiguous equal priority

Different results can be selected at the same priority.

### WRT-SCORE-006 Non-monotonicity violation

A methodology asserts that more strong actions cannot reduce compliance, but bounded analysis finds a counterexample. Declared counteraction exceptions are respected.

### WRT-SCORE-007 Threshold gap or off-by-one

Adjacent integer ranges do not cover a boundary or cover it twice.

### WRT-CLASS-001 Overlapping exclusive classifications

An action can be both strong and weak, or counter and strong, with no priority or multi-label declaration.

### WRT-CLASS-002 Unreachable classification

A label rule can never be selected.

### WRT-ID-001 Count without identity policy

The methodology counts actions but does not specify the count unit.

### WRT-ID-002 Possible action splitting

Several labels or rule clauses count announcements, outputs, and programs without a declared relationship or deduplication rule.

### WRT-ATTR-001 Attribution policy missing

Joint, collective, or supranational actions can enter the evidence domain but the methodology does not state how they affect member scores.

### WRT-DIM-001 Declared dimension never used

A dimension is described in prose or declared in the DSL but never influences classification or scoring.

### WRT-DIM-002 Used dimension not declared

A scoring condition references undeclared dimensions, goals, or partner classes.

### WRT-ART-001 Artifact completeness under-specified

A rule requires a complete roadmap, plan, or framework without defining required fields.

### WRT-SRC-001 Rule lacks source or rationale

A normative definition, exclusion, or score branch has neither an authoritative source anchor nor an explicit methodologist rationale.

### WRT-PROSE-001 Prose and formal rule discrepancy

A machine or reviewer-provided prose assertion conflicts with the executable score table.

Known benchmark fixture: the transnational-crime chapter contains language that can be read differently from the score thresholds.

### WRT-VERS-001 Semantic change without major version

A methodology update changes a possible result but does not increment the major methodology version.

## 4. Bounded analysis with Z3

The analyzer lowers finite-domain score logic to SMT constraints.

Recommended uses:

- branch satisfiability;
- pairwise overlap;
- exhaustive coverage;
- threshold gaps;
- unreachable branches;
- monotonicity counterexamples;
- required-dimension coverage;
- artifact field combinations;
- attribution-policy coverage.

### 4.1 Domain declarations

Methodology assertions define bounded domains:

```text
assert score.exhaustive over {
  strong_count in 0..20;
  weak_count in 0..20;
  covered_partner_classes in 0..7;
  counter_exists in { true, false };
  roadmap_complete in { true, false, unknown };
};
```

The bounds are analysis bounds, not runtime caps.

### 4.2 Counterexample output

A diagnostic must include a concrete witness:

```text
WRT-SCORE-001 Non-exhaustive score table
Witness:
  strong_count = 0
  weak_count = 5
  counter_exists = false
No rule is true.
Potentially affected result: unresolved.
```

This makes methodology review actionable.

## 5. Model-based prose checks

A language model may compare explanatory prose against compiled rules, but its output is only a candidate diagnostic.

Pipeline:

1. Render the normalized score table into controlled natural language.
2. Compare it with source-linked methodology prose.
3. Ask the model to identify potential contradictions or omissions.
4. Require a methodologist to confirm the diagnostic.
5. Store the prompt, model, output, and decision.

Never let model output alter the score program automatically.

## 6. Corpus-wide analysis

Run cross-package checks:

- inconsistent definitions of repeated terms;
- different treatments of announcements without rationale;
- score thresholds that vary unexpectedly across similar commitments;
- inconsistent member or EU attribution;
- identical actions counted differently across commitments;
- inconsistent source-tier requirements;
- duplicate commitment identifiers;
- stale imported ontology versions;
- historical membership mistakes.

Inconsistency is not necessarily an error. The tool should surface it for review.

## 7. Linter profiles

### Authoring profile

Fast diagnostics suitable for editor feedback.

### Publication profile

Runs full type checking, source requirements, Z3 checks, scenario tests, and package-signing prerequisites.

### Benchmark profile

Adds comparison against published scores and requires a discrepancy record for every mismatch.

### Historical-import profile

Permits incomplete source hashes and legacy ambiguities but marks the output non-publishable.

## 8. Static analysis architecture

```text
AST
 -> name resolution
 -> type checking
 -> normalized expression IR
 -> semantic lint rules
 -> finite-domain extraction
 -> Z3 constraint model
 -> counterexample minimization
 -> diagnostics with source maps
```

Do not couple diagnostics to editor code. Diagnostics are a versioned API product.

## 9. Test fixtures required in the repository

- AI for SMEs uncovered weak-count state.
- AI for SMEs counteraction overlap.
- Equal-priority different-score overlap.
- Dead branch.
- Missing action identity policy.
- Unknown evidence crossing a threshold.
- Possible duplicate actions changing count from four to five.
- Critical-minerals missing partner-class coverage.
- Artifact marked complete while a required field is unknown.
- Multi-dimensional score with one undeclared dimension.
- Prose and score-table mismatch.
- Non-monotonic strong-action score.
- Currency aggregation without conversion policy.
- Collective EU action with no attribution policy.

## 10. Acceptance criteria

- Every seeded fixture produces the expected diagnostic code and a minimal witness.
- Diagnostics are stable enough for CI assertions.
- The analyzer can process all 20 2025 methodologies as one corpus.
- Publication mode fails on unwaived errors.
- Waivers identify diagnostic code, object, methodology version, author, rationale, and expiration or review condition.
