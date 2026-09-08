# Decision episode build — engineering report

## Verdict

**PROPOSE RETAINING ONE NARROW SEMANTIC: `replayable decision episode`. STOP AT THE HUMAN
ARCHITECTURE GATE.**

The build earns real provenance and reuse value beyond loose files: one deterministic object can
fail closed when any referenced source, assumption, applicability, execution, certificate, decision,
implementation, observation or reconsideration link is substituted, and a fresh recipient can
recheck every mathematical artifact without replaying or inventing the human acts.

This is a proposed architecture under ADR 0029, not an accepted semantic until a human disposition
is recorded. It is not another Bellman transfer.

## Baseline and reuse

The branch starts at `4e9b7f49e240e4ca5d6a8df0c6b8ecb060d606e2`, the merge commit for PR
#51. The implementation reuses:

- `DecisionExecution` exact case/analysis/problem/query/candidate binding and fresh checking;
- shared-analysis scoped imports, explicit revisions, impact, reassessment and original/successor
  execution preservation;
- PR #51's exact certificate-transport record and checker-only replay; and
- Writ's existing exact JSON, base64 and SHA-256 primitives.

No Bellman, Decision Lab or Aldera source was changed. The exact Decision Lab authorities remain
the pins already recorded by ADR 0026 and PR #51.

## Implemented story

Only one story is exercised:

1. The original alpha analysis is freshly checked and says A is uniformly strictly optimal.
2. The supplied X=1/2 revision changes the mathematical subject.
3. `assessRevision` marks applicability stale while preserving the old execution.
4. A supplied, exact-basis `supported` reassessment allows successor computation.
5. The successor is freshly checked and says B is uniformly strictly optimal.
6. PR #51 produces and checks the exact revised certificate transition.
7. The synthetic Failure Review Board explicitly decides A under a supplied authority statement.
8. A distinct record says A was implemented.
9. A supplied observation reports a loss of 1 unit and makes no causal, correctness or model claim.
10. The board explicitly requests reconsideration with no automatic model effect.
11. A relocated producer-disabled recipient freshly checks the original execution, successor
    execution and certificate transport while preserving the later declarations only by exact hash.

The A-versus-B mismatch is intentional. Writ accepts the explicit A decision because it is a human
act, not because it agrees with or is derived from the mathematical optimum.

## Contract safeguards

The schema is closed. A decision is mandatory. Authority has a separately preserved byte artifact
and the explicit status `supplied_not_verified_by_writ`. Observation objects cannot contain
structured causality, decision-correctness or model-update claims. Those claims, if supplied, must be
separate interpretation declarations with independent review status. Reconsideration cannot mutate
the model and points only to human review.

The implementation rederives the checked-history binding from the embedded PR #51 record. It does
not trust duplicate caller hashes. The binding includes exact source and assumption identities,
revision impact and reassessment basis, target problem/query, original and successor executions, and
source/target certificates. Event references and strictly increasing supplied UTC times form one
episode chain without implying causality.

Recipient replay invokes the existing decision and transport checkers. It does not call a producer.
Fresh mathematical results and preserved declaration hashes appear in separate report sections.

## Separate-files comparison

Separate JSON and text files remain sufficient if a disciplined operator only needs storage. They
can contain all the same prose and bytes with less Writ code, and Writ claims no mathematical or
empirical advantage over them.

The episode object adds value only where a recipient needs deterministic guarantees that all files
belong to the same exact checked/revised/applicable history, that the event references form one
chain, and that fresh mathematical checks can be rerun without mistaking preserved decisions or
observations for checked facts. Those are concrete provenance/reuse benefits, so this report proposes
retaining the narrow envelope.

## Unearned semantics

The build does not earn:

- causal inference or effect attribution;
- automatic outcome or decision evaluation;
- automatic model revision, learning or belief update;
- actor authentication or real-world authority verification;
- workflow/case management, scheduling or approvals;
- a database, knowledge graph, universal ontology or solver registry;
- a UI or autonomous decision-maker; or
- another Bellman capability.

## Verification evidence

PR [#53](https://github.com/saykig/Writ/pull/53) is the unmerged human architecture gate. Local
verification on the proposed combined tree passed:

- the seven repository gates: format, lint, typecheck, test, data check, Writ verification and
  build;
- pack validation, source-registry drift, Ruff and mypy;
- 75 Python tests;
- Decision Case 16/16, Shared Analysis 2/2, Certificate Transport 12/12 and Decision Episode 1/1,
  all with zero integration skips; and
- exact tree verification of all 204 files from Decision Lab commit
  `e5f77dfcf929708951f4673b3f394461ef09c752`, using CPython 3.13.15 and SciPy 1.17.0.

Hosted CI remains required on the final pushed head before handoff. The human gate should evaluate
the semantic separation and extra provenance value, not infer architecture acceptance from green
automation.
