# Certificate transport integration — bounded engineering report

## Verdict

**RETAIN THE NARROW TRANSITION SEMANTIC; STOP BEFORE AUTOMATICALLY PORTING ANOTHER BELLMAN COMPONENT.**

This build earns one reusable Writ operation: a **revision-bound checked mathematical transition**.
It preserves the exact source-certificate bytes and prior claim context, binds a substantive Writ
revision and current applicability reassessment to an explicitly declared mathematical transport
request, preserves the exact successor certificate, and lets a fresh recipient independently check
the source, successor, and stronger transport provenance. Archival preservation makes no validity
claim.

It does **not** earn a generic Bellman theorem registry, automatic evidence-to-model translation,
certificate accumulation, structural transport between different decision trees, or a general
sequential decision engine.

## Human architecture gate

Before the transport build, ADR 0026 and ADR 0028 were both Proposed despite the merged evidence from
PR #43 and PR #47. This task resolves that gate explicitly:

- **ADR 0026 — Accepted.** The bounded derived-decision boundary has survived exact subject binding,
  independent producer/checker execution, stale-use refusal, applicability separation, immutable
  revisions, and cross-analysis reuse. The direct-script baseline remains mathematically adequate;
  Writ earns durable provenance, revision, and handoff safeguards rather than stronger mathematics.
- **ADR 0028 — Accepted.** PR #47 demonstrated separately authored analysis import, shared exact
  evidence without inferred dependence, scoped revision impact, exact reassessment basis, old
  execution preservation, successor recomputation, and checker-only replay. Its semantic hardening
  removed fixture-ID dependence and optimistic check-status reuse.

Acceptance remains bounded to the contracts those ADRs actually describe. It is not retrospective
permission for every future Bellman component to use the same engineering shape.

## Mathematical and executable authority

The mathematical operation is Bellman's hardened certificate-transport/revalidation construction:

- Bellman integration point: `aae1b56276b231d16748473f4a54dd4a9ea514cf`;
- mathematical record: `foundations/BELLMAN_CERTIFICATE_TRANSPORT_AND_REVALIDATION.md`;
- authoritative record SHA-256:
  `c6d9db76f62783918bbd64b9141095ca0de02f4c2d266db18f42f45e4d8e6253`.

The executable adapter is the merged Decision Lab PR #4 result:

- Decision Lab commit: `e5f77dfcf929708951f4673b3f394461ef09c752`;
- request contract: `certificate-transport-request.v1`;
- guarantee: `expected-additive-total-cost-regret`.

Writ keeps the existing Build 1/2 engine pin unchanged and verifies the transport adapter as a
separate additive source closure. The fixed bridge uses CPython 3.13 in isolated, no-bytecode mode
and rejects repository-module origins outside the verified source-only snapshot.

## Implemented change story

The integration reuses PR #47's accepted revision and applicability lifecycle rather than creating a
parallel history model.

1. An exact original `DecisionExecution` and the source-certificate bytes are preserved in the
   shared-analysis and transport archives without treating preservation as a validity result.
2. A substantive revision declares a changed successor mathematical subject.
3. `assessRevision` reports that the analysis is affected and that current applicability requires
   reassessment; the old claim context remains inspectable, but archive presence does not establish
   validity.
4. Certificate transport is refused until the exact revised basis has a current `supported`
   applicability declaration.
5. The caller explicitly declares which exact target request fields implement the revised model or
   policy premise. Writ checks that each path resolves on source and target and that the value
   actually changed. It does not claim the caller's mapping rationale is empirically true.
6. The pinned Decision Lab producer constructs the target certificate.
7. The independent checker verifies ordinary target-certificate validity and the stronger anchored
   transport warrant separately.
8. The portable Writ record embeds the exact accepted shared-analysis archive plus exact request,
   candidate evidence, producer-time check, source-certificate identity, target-certificate
   identity, revision-impact identity, reassessment-basis identity, and prior/target analysis
   identities.
9. A recipient reopens the record and runs only the checker on the preserved candidate. The stored
   producer-time status is not authority.
10. The same recipient can independently replay the old and successor PR #47 executions through the
    existing shared-analysis checker-only path.

The integration explicitly rejects a no-op transport, a label/premise-only rename presented as a
mathematical revision, and a declared changed-request path whose source and target values are equal.

## Exact exercised outcome

The Bellman comparator-change control uses source immediate costs `(a,b)=(1,2)`, target costs
`(a,b)=(1,0)`, and retains candidate policy `a`. The old source certificate has lower=upper=`1`.
The transported target certificate has root lower `0`, upper `1`, so the independently checked regret
upper bound is `1`.

The important status separation survives Writ transport:

- source-certificate bytes: preserved exactly, with no validity implied by preservation;
- fresh source-certificate status: checked under the exact old subject;
- target certificate: separately checked under the exact target subject;
- transport provenance: separately checked as a valid anchored derivation from the old certificate;
- applicability: separately supplied and bound to the revised Writ basis;
- human/institutional authority: not created by any of these checks.

## Real integration evidence

Because `saykig/writ-decision-lab` is private, Writ's ordinary repository token cannot perform a
cross-repository checkout. The real no-skip integration therefore ran from a temporary private
Decision Lab validation branch while checking out the exact Writ implementation commit
`dccd5908debc6f364723a69d15a0364aea4acd00`.

Validation run:

- Decision Lab Actions run: `34181930145`;
- job: `101922604267`;
- CPython: `3.13.15`;
- Bun: `1.3.12`;
- SciPy: `1.17.0`;
- result: **success**.

No-skip results:

- Decision Case integration: **16 pass, 0 fail, 147 assertions**;
- Shared Analysis integration: **2 pass, 0 fail, 22 assertions**;
- Certificate Transport integration: **4 pass, 0 fail, 18 assertions**.

The certificate-transport integration's four cases are:

1. refuse transport before applicability reassessment;
2. refuse no-op and label-only transports;
3. require every declared changed-request field to be an actual source/target change;
4. preserve the old result, record the substantive revision, require reassessment, construct the
   successor, and perform checker-only recipient replay.

That run is retained as historical implementation evidence. The final acceptance review reruns the
real integration after every semantic hardening change rather than inferring success from this
earlier commit.

## Final acceptance hardening

The final review independently retained ADR 0026 and ADR 0028 as Accepted before evaluating the
transport extension. Current Writ main `d4f2769f1f7e935809225677505779a62770dcde` was then merged
non-destructively. Its v0.0.8 release history remains intact; the transport work does not rewrite a
published release or make this capability retroactive.

One assurance defect required repair. Recipient replay previously emitted
`source_certificate_status: checked` unconditionally after reading a record whose stored
producer-time report claimed success. The exact PR #4 checker validates the ordinary target first,
then the source certificate, then request/evidence transport bindings and the anchored envelope.
Replay now derives source status from that fresh checker path: `checked`, `rejected`, or
`not_checked`. It also verifies that both producer-time and fresh reports name the exact supplied
request and evidence byte hashes. A stored report can no longer make a fresh component status true.

The public replay projection now reports `source_certificate_bytes_preserved: true` as a descriptive
archive fact instead of claiming that the historical guarantee is preserved. The separate
`source_certificate_status` is derived only from the fresh recipient checker. A regression archives
an invalid source certificate, preserves its exact bytes, and requires fresh replay to report the
source as `rejected` rather than translating archive presence into validity.

The explicit model-to-request premise is also tighter. A declared changed field must resolve on both
source and target, actually differ, and identify a mathematical subject or policy field;
descriptive-only `subject.name` and `subject.premises` paths cannot conceal the real mathematical
change.

The expanded real suite retains failures for missing/stale/wrong reassessment context; wrong
revision, analysis, prior/target analysis, impact, basis, and adapter identities; exact request,
evidence, producer-check, source-certificate, and target-certificate mutation; no-op, label-only,
descriptive-only, and falsely unchanged mappings; action-menu, horizon, unit, criterion, and
observable-history changes; exact adapter source drift; and an invalid archived source certificate.
Forged stored success reports are
replayed with the producer disabled. The fresh checker separately demonstrates a valid target with
invalid anchored provenance, an invalid source with a still-valid target, and an invalid target for
which source/transport are not claimed checked. Applicability remains necessary before transport,
and the closed record schema rejects an authority-to-act field.

The final no-skip transport run reports 9 pass, 0 skip, and 64 assertions against exact Decision Lab
merge `e5f77dfcf929708951f4673b3f394461ef09c752`, CPython 3.13.15, and SciPy 1.17.0. The complete
post-PR52 repository verification reports 582 Bun tests passing, 8 explicit backend-gated skips, and
0 failures; all seven repository gates pass, including byte-identical export of 81 records, 16
links, and 65 judgments, plus all four Writ verification dimensions with 0 errors and 0 warnings.
The pinned Decision Case integration reports 16 pass and 147 assertions; Shared Analysis reports 2
pass and 22 assertions; both have zero skips. Pack validation, source-registry drift, Ruff, mypy, and
all 75 Python tests pass. Hosted PR evidence is recorded after the final branch push.

## Simpler-workflow comparison

Bellman's own exact reference and the Decision Lab adapter remain simpler if the task is merely to
construct and check one transport certificate. A direct script can obtain the same mathematical
answer with less Writ-owned machinery.

Writ earns its additional layer only because it preserves, in one inspectable chain:

- the exact old result and old premises;
- the substantive revision and its dependency impact;
- the current applicability reassessment;
- the explicit model-to-request mapping premise;
- the old and successor certificate identities;
- target validity versus transport-provenance validity;
- portable checker-only replay.

That is a provenance/revision/reuse gain, not a mathematical-strength or productivity claim.

## Reusable semantic earned

The reusable object is deliberately smaller than a generic certificate system:

> **Revision-bound checked mathematical transition** — an immutable attachment that links one
> accepted Writ revision/reassessment basis to an exact old mathematical guarantee, an explicit
> changed mathematical request, an exact successor certificate, and independently checkable
> transition provenance.

Its stable meanings are:

- exact source-certificate bytes and prior claim context remain archived without asserting validity;
- current reuse can become stale independently of old mathematical truth;
- mapping from revised evidence/model premises to mathematical request fields is explicit and
  reviewable, never silently inferred;
- target-certificate validity and transport-from-old provenance are different claims;
- recipients fresh-check rather than trusting stored status.

This semantic fits the standing Writ architecture because it extends the accepted PR #47 change
story without adding a second revision authority.

## What was not earned

Do not infer any of the following from this build:

- automatic evidence-to-model or source-to-cost translation;
- automatic certificate transport whenever a Writ dependency changes;
- structural correspondence between different trees, menus, information structures, criteria, or
  units;
- certificate accumulation or policy-selection semantics from Bellman PR #7;
- persistent-model, family-aware replanning, statistical-learning, causal, strategic, safety, or
  authority-to-act semantics;
- a generic solver or certificate registry;
- a production-language migration or a need for a Rust checker yet;
- empirical validity of the synthetic model or its mapping declaration.

## Stop / next decision

**Stop the Bellman transfer sequence here.** Do not automatically port certificate accumulation or
another Bellman theorem simply because certificate transport succeeded.

The next mathematical transfer should occur only when a concrete Writ workflow exposes a need that
cannot be met cleanly by the accepted decision-case, shared-analysis, and revision-bound transition
semantics. If a later workflow genuinely needs two compatible certificates to strengthen one
another, Bellman certificate accumulation becomes a candidate then—not before.
