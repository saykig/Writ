# EU–US AI evaluation pilot — human-reviewed

This directory preserves one pilot analysis over reviewed EU and US material. The comparison
question, headline rule, and conclusion are query-layer objects; they do not define either
jurisdiction's corpus. Independent active EU and US corpora will be created by the repository reset.

The pilot asks one comparative question of two jurisdictions:

> Does the jurisdiction currently impose a binding model-evaluation requirement on
> providers of advanced or general-purpose AI models?

The answer is yes for the EU, for one defined class of provider, and no for the United
States. Neither answer is asserted here. Both are **derived** from the reviewed claims by
`derive_headline_judgments`, and validation fails if the derivation and the reviewers'
stated judgment disagree.

## Layout

| Path                                     | Role                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `annotations/human-reviewed.yaml`        | The authoritative hand-reviewed annotation table. Never rewritten by any script. |
| `schemas/reviewed_dataset.schema.json`   | Contract for the reviewed table                                                  |
| `schemas/normalized_claim.schema.json`   | Contract for one generated claim                                                 |
| `schemas/headline_judgments.schema.json` | Contract for the derived judgments                                               |
| `normalized/records.json`                | The 24 parent rows, canonical JSON                                               |
| `normalized/claims.json`                 | The 32 normalized claims                                                         |
| `normalized/headline-judgments.json`     | The derived judgments and their evidence                                         |

Code lives at `apps/ingest/src/writ_ingest/pilot/eu_us_ai_evaluation.py`; the emitter is
`scripts/emit_eu_us_ai_evaluation.py`; the tests are `tests/pilot/test_eu_us_ai_evaluation.py`.

The pilot is deliberately separate from the `schemas/` compliance-corpus family, which is
scoped to G7/G20 summit commitments at `schema_version 2.0.0` and cannot express
jurisdiction-keyed legal claims without a breaking change.

## Row identity

Row numbering comes from the uploaded annotation table and from nothing else. Source order
never renumbers a row. `EU-01`…`EU-12` and `US-01`…`US-12` appear in that order, and the
schema's `minItems`/`maxItems` and row-id pattern make a 25th row or an `EU-13` impossible.

An earlier draft assigned two scope and notification passages the `EU-06` and `EU-07`
identifiers, displacing the Article 55(1) obligations. The review removed them:

| Temporary row | Source            | Status                           |
| ------------- | ----------------- | -------------------------------- |
| EU-06         | Article 51(1)–(2) | Removed from the reviewed corpus |
| EU-07         | Article 52(1)     | Removed from the reviewed corpus |

Neither passage exists anywhere in this repository as a reviewed record, and validation
proves it: no row in `EU-01`…`EU-12` may carry either locator. Article 51 and 52 are not
reintroduced as supplemental sources, because the reviewed dataset records no excerpt,
date, or authority for them and inventing one is out of scope.

The corrected Article 55(1) numbering:

| Source           | Row   |
| ---------------- | ----- |
| Article 55(1)(a) | EU-06 |
| Article 55(1)(b) | EU-07 |
| Article 55(1)(c) | EU-08 |
| Article 55(1)(d) | EU-09 |

## Normalization

A leaf parent yields exactly one claim, keeping its row id. A `source_bundle` parent yields
one claim per child, because its children are legally distinct and must not be merged:

| Bundle                                    | Children               |
| ----------------------------------------- | ---------------------- |
| EU-10 Commission GPAI guidelines          | EU-10A, EU-10B, EU-10C |
| EU-11 Article 113 timetable               | EU-11A, EU-11B         |
| US-05 CAISI guidelines page               | US-05A, US-05B         |
| US-08 OMB M-25-21 high-impact AI          | US-08A, US-08B         |
| US-09 OMB M-25-22 procurement testing     | US-09A, US-09B, US-09C |
| US-10 OMB M-25-22 contracted AI oversight | US-10A, US-10B         |

18 leaves + 14 children = **32 claims**. Every reviewed field is copied verbatim. Nothing is
defaulted, inferred, or filled in.

## What the distinctions are for

Four collapses would each produce a wrong answer, so each is a separate field and a separate
check:

- **Legal force is not compliance function.** The GPAI Code of Practice is `voluntary` and a
  `recognized_compliance_path` at the same time. Reading the second as the first would turn a
  voluntary code into a statutory duty.
- **Adoption, applicability, and enforcement are three dimensions.** They are three required,
  non-nullable fields with disjoint vocabularies. Twelve EU claims record
  `enforcement_status: unknown`; `unknown` is a recorded value, not a missing one, and never
  becomes `not_applicable`.
- **Government duties are not market duties.** No US claim places a duty on a market provider.
  Market providers appear in US records only as indirectly affected (US-06), expressly excluded
  (US-07), or prospective (US-11). `binding_scope` records the limit; `actor_type` records who
  actually bears the duty.
- **Documentation is not evaluation.** Exactly four claims record
  `conduct_type: model_evaluation` — EU-06, US-03, US-05A, US-05B. Documentation, risk
  assessment, incident reporting, monitoring support, evaluation access, pre-deployment testing,
  procurement testing, and reporting are all something else. US-08A and US-09A carry
  `conduct_family: evaluation`, but `evaluation` is not a member of the `conduct_type`
  vocabulary, so the family can never be promoted into the type.

## Derivation

A claim establishes a binding model-evaluation duty on providers when **all four** hold:

```
legal_force == binding
applicability_status == applicable
actor_type == market_provider
conduct_type == model_evaluation
```

`enforcement_status` is deliberately not read: an unknown enforcement status must not defeat a
binding, currently applicable duty. A parametrized test substitutes every enforcement value into
every claim and asserts the positive set is unchanged.

| Derived finding             | Predicate                                                                                             | Evidence                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| EU decisive                 | the rule above                                                                                        | `EU-06`                               |
| EU supporting               | `headline_relevance ∈ {supporting_only, scope_activation_support, establishes_current_applicability}` | `EU-01, EU-02, EU-07, EU-10B, EU-11A` |
| EU qualifying               | `headline_relevance == qualifies_current_applicability`                                               | `EU-11B`                              |
| US cross-sector             | the rule above, US only                                                                               | — (empty)                             |
| US voluntary cross-sector   | `voluntary ∧ adopted ∧ cross_sector ∈ scope`                                                          | `US-01…US-04, US-05A`                 |
| US federal government use   | `binding ∧ federal_agencies_only ∧ government_use ∈ scope`                                            | `US-08A, US-08B`                      |
| US federal procurement      | `binding ∧ federal_agencies_only ∧ government_procurement ∈ scope`                                    | `US-09A, US-09B`                      |
| US contract-mediated vendor | `contractual ∧ government_vendor`                                                                     | `US-09C, US-10A, US-10B`              |
| US proposed future          | `proposed(legal_force) ∧ proposed(adoption_status)`                                                   | `US-11`                               |

The last predicate needs both conjuncts: US-05B is `adoption_status: proposed` but
`legal_force: voluntary`, so a proposed _draft benchmark practice_ stays out of the
proposed-_regulation_ finding.

The labels attached to each finding are selected by the derived predicate — a finding with no
qualifying claims takes its negative label. The evidence lists are never hardcoded.

### Result

- **EU** — `binding_applicable_for_defined_class`, for providers of a general-purpose AI model
  with systemic risk. EU-06 (Article 55(1)(a)) is the sole decisive evidence. EU-11B preserves a
  transition period for models placed on the market before 2025-08-02.
- **US** — `no_current_binding_model_evaluation_requirement` cross-sector, alongside binding
  government-use controls, binding procurement controls, contract-mediated vendor duties, active
  voluntary evaluation guidance, and one proposed reporting and disclosure standard. Five
  findings, kept separate.

## Regenerate and verify

```bash
python3 scripts/emit_eu_us_ai_evaluation.py --check
```

```bash
python3 scripts/emit_eu_us_ai_evaluation.py
```

The emitter reads no clock and no network, so re-running it on unchanged input rewrites the
same bytes. A test asserts the checked-in artifacts match a fresh derivation, so they cannot
drift from the reviewed table.

```bash
pytest tests/pilot -v
```
