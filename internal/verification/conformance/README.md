# Writ core conformance suite

An implementation-independent corpus of declarative cases for the Writ
semantic core (04_FORMAL_SEMANTICS.md §19, 11_TEST_AND_VALIDATION.md §3). Every
case is pure data. The corpus imports nothing and depends on no engine. Any
evaluator that implements the Writ semantics can consume it: read each case,
dispatch on `kind`, run `input`, and check the produced value against `expected`.

The canonical runner that proves the reference `@writ/*` stack passes every
case lives at `packages/conformance/`. It is one consumer of this corpus, not
part of it.

## Layout

```text
internal/verification/conformance/
  case.schema.json      JSON Schema for a case (or an array of cases)
  cases/<area>/*.json   the cases, grouped by area
```

A case file holds either a single case object or an array of case objects. Both
validate against `case.schema.json`. The ten areas are:

| area               | covers                                                                |
| ------------------ | --------------------------------------------------------------------- |
| `truth`            | the four-valued kernel: `not`/`and`/`or` tables, empty quantifiers    |
| `expressions`      | equality, comparison, exact decimals, sets, count-interval thresholds |
| `temporal`         | `before`/`after`/`overlaps`, date-only whole-day boundaries           |
| `quantities`       | money bounds (`exact`/`up_to`/`at_least`), currency compatibility     |
| `identity`         | distinct-count intervals under the four identity policies             |
| `classification`   | exclusive vs multi-label selection, ambiguity, unknown-not-defaulting |
| `scoring`          | deterministic score selection and bounded score analysis              |
| `proofs`           | evaluation-receipt result/status, determinism, hash verification      |
| `canonicalization` | RFC 8785 canonical JSON and content hashing                           |
| `diagnostics`      | stable diagnostic codes for lint/type/unit findings                   |

## Case shape

```json
{
  "id": "truth.and.contested-true",
  "area": "truth",
  "kind": "truth.and",
  "description": "contested AND true = contested",
  "input": { "left": "contested", "right": "true" },
  "expected": "contested"
}
```

`id` is unique and stable. `area` and `kind` are closed enums (see the schema).
`input` and `expected` shapes depend on `kind`, documented below.

## Comparison

`expected` is compared to the produced value by structural deep-equality:

- objects compare key-by-key and are insensitive to key order;
- arrays compare element-by-element and are order-sensitive;
- scalars compare by value (`"unknown" === "unknown"`).

Where `expected` is an object with a `diagnostics` array, the produced diagnostic
**codes** are collected and sorted ascending before comparison, so a case pins
the set of codes without depending on their emission order or their human
messages.

## Truth values

A four-valued truth is one of the strings `"true"`, `"false"`, `"unknown"`,
`"contested"` (Belnap support pair, §2). `not` swaps support; `and` conjoins
truth-support and disjoins false-support; `or` is the dual.

## Expression AST

`expr.*` cases carry a Writ IR expression (`canonical-ir.schema.json`
`#/$defs/expr`). The node kinds used here:

```jsonc
{ "kind": "literal", "value": <any> }
{ "kind": "ref", "path": "dotted.path" }         // resolved against input.facts
{ "kind": "unary", "op": "not|is_known|is_contested|nonempty", "operand": <expr> }
{ "kind": "nary", "op": "and|or|set|add|multiply", "operands": [<expr>, ...] }
{ "kind": "compare", "op": "eq|neq|gt|gte|lt|lte|in|between|overlaps|before|after|contains",
  "left": <expr>, "right": <expr> }
{ "kind": "query", "operation": "count|count_distinct|exists|forall|sum|ratio|coverage|min|max",
  "collection": "name", "where": <expr>, "distinct_by": "path", "select": <expr> }
```

A `ref` resolves against `input.facts` (a fact environment). A missing path is
`unknown`, never `false`. A fact value may itself be a four-valued string, a
boolean, a number, an exact-decimal string, a count interval `{min,max}`, a money
record `{value,currency,bound}`, an ISO-8601 instant string, or a temporal
interval `{start,end}`.

## The evaluation environment

`expr.*`, `count.interval`, and `classify.evaluate` cases may supply an
environment through `input`:

```jsonc
{
  "facts": { "count": { "min": 4, "max": 6 } }, // dotted-path fact map
  "collections": { "actions": [{ "id": "a1" }] }, // named record arrays for queries
  "identity": { "policy": "review_required", "key_paths": ["key"] },
  "scoreDecisive": true, // governs review_required blocking
  "declaredSets": { "partner_classes": ["p1"] }, // coverage denominators
  "temporal": { "as_of": "2025-06-01", "cutoff": "2025-06-01" },
}
```

All fields are optional. `identity` defaults to
`{ policy: "strict_separate", key_paths: ["id"] }`, `temporal` to a fixed frozen
instant. Evaluation is a pure function of these frozen inputs: no wall-clock, no
randomness.

## Per-kind contract

### `truth.not`

- input: `{ "value": <truth> }`
- expected: `<truth>` — the negation.

### `truth.and`, `truth.or`

- input: `{ "left": <truth>, "right": <truth> }`
- expected: `<truth>`.

### `truth.all`, `truth.any`

- input: `{ "values": [<truth>, ...] }` (may be empty)
- expected: `<truth>` — the finite conjunction (`all`, identity `true`) or
  disjunction (`any`, identity `false`). The empty cases pin vacuous `forall = true`
  and `exists = false` (§2.5).

### `expr.evaluateTruth`

- input: `{ "expr": <expr>, ...environment }`
- expected: `<truth>` — the expression's four-valued truth.

### `expr.evaluate`

- input: `{ "expr": <expr>, ...environment }`
- expected: `{ "truth": <truth>, "diagnostics": [<code>, ...] }` — truth plus the
  sorted set of diagnostic codes raised (e.g. `"WRT-LINT-UNIT"` for a currency
  mismatch). `diagnostics` is `[]` when none are raised.

### `compare.interval`

- input: `{ "op": "eq|neq|gt|gte|lt|lte", "left": {min,max}, "right": {min,max} }`
- expected: `<truth>` — four-valued interval comparison (§7): `true` when the whole
  interval satisfies the relation, `false` when it wholly violates it, `unknown`
  when it straddles the threshold.

### `count.interval`

- input: `{ "query": <query-expr>, ...environment }`
- expected: `{ "interval": {min,max} | null, "blocking": <bool>, "diagnostics": [<code>, ...] }`
  — the distinct/membership count interval (§7, §8), whether a score-decisive
  `review_required` possible-duplicate blocked publication, and the sorted codes.
  `interval` is `null` when the query result carries no count interval.

### `classify.evaluate`

- input: `{ "block": <classification-block>, ...environment }` where a block is
  `{ id, mode: "exclusive"|"multi_label", rules: [{id,label,priority,when}],
otherwise_label?, otherwise_safe_under_open_world? }`.
- expected: `{ "label": <string|null>, "labels": [<string>...],
"unknownLabels": [...], "contestedLabels": [...], "status": <status>,
"diagnostics": [<code>...] }` (§6). `status` is one of `supported`, `ambiguous`,
  `contested`, `incomplete`, `unclassified`.

### `score.evaluate`

- input: `{ "program": <score-program>, "facts": {...} }` where a program is
  `{ rules: [{id,priority,result,when}], otherwise: {result,message} }`.
- expected: `{ "result": <"-1"|"0"|"+1"|"not_applicable"|"unresolved">,
"status": <"supported"|"contested"|"incomplete"|"ambiguous"|"invalid">,
"matchedRuleId": <string|null>, "diagnostics": [<code>...] }` (§12–13).

### `score.analyze`

- input: `{ "program": <score-program>, "domains": { var: [values...] }, "objectId"?: string }`
- expected: an array of `{ "code": <code>, "severity": <"error"|"warning">,
"witness"?: {var: value} }`, sorted ascending by JSON serialization. Witnesses
  are minimized lexicographically in alphabetical variable order, so they are
  deterministic (§19: deterministic canonical analysis). A clean program expects `[]`.

### `canonicalize`

- input: `{ "value": <json>, "options"?: { "dropFields": [<pointer>...] } }`
- expected: `<string>` — the RFC 8785 canonical JSON (§16): keys sorted by UTF-16
  code unit, strings NFC-normalized, `dropFields` (RFC 6901 pointers) removed,
  array order preserved.

### `hash`

- input: `{ "value": <json>, "algorithm"?: "sha256Canonical"|"receipt"|"methodologyBundle" }`
- expected: `<string>` — `"sha256:" + hex(sha256(utf8(canonicalJson(value))))`.
  `receipt` and `methodologyBundle` are the named helpers; `receipt` additionally
  drops the self-referential `/canonical_hash` and `/signature` transport fields
  before hashing, so a receipt's hash is stable across changes to those fields.
  Default is `sha256Canonical`.

### `receipt.evaluate`

- input: `{ "ir": <canonical-ir>, "snapshot": <evidence>, "subject": <string>,
"commitmentId"?: string, "as_of"?: string, "cutoff"?: string }`
- expected: `{ "result": <score-result>, "result_status": <status>,
"matched_rule_id": <string|null> }`.
- Beyond `expected`, the runner enforces three hard invariants on every receipt
  case: the produced receipt validates against `evaluation-receipt.schema.json`,
  its self-describing `canonical_hash` verifies, and two independent runs produce
  byte-identical canonical JSON (deterministic replay, §16).

## Adding a case

1. Pick the `area` and a `kind`.
2. Author `input` as frozen data and `expected` as the value the semantics require
   (derive it from the spec, not from any one implementation).
3. Validate the file against `case.schema.json`.
4. Confirm the canonical runner passes it (`bun test packages/conformance`).

If the canonical engine disagrees with a spec-derived `expected`, that is a
finding about the engine or the spec, not a reason to weaken the case.
