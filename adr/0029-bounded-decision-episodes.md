# ADR 0029: Add bounded replayable decision episodes

**Status:** Proposed in DECISION-EPISODE-001; awaiting human architecture disposition

## Context

Accepted ADR 0026 preserves exact mathematical subjects, checked executions, applicability and human
disposition. Accepted ADR 0028 adds shared revision, reassessment, successor computation and fresh
recipient replay. PR #51 adds one narrowly retained, revision-bound checked mathematical transition.
Those contracts can reconstruct what was checked and why it became stale, but they do not yet bind
that history to what an authorized human or institution actually decided, what was implemented,
what was later observed, or whether someone explicitly reopened the decision.

The missing link is provenance, not another mathematical theorem. A checked optimum cannot supply
authority or make a decision. A post-implementation observation cannot establish causality,
correctness, or a model update. Any bounded episode representation must preserve those separations
while reusing the accepted mathematical and revision objects unchanged.

## Options considered

### 1. Keep independent JSON and text files

A careful operator can keep the PR #51 record, a decision note, an authority statement, an
implementation record, an observation and a reconsideration note as separate files. This has the
smallest implementation cost and is sufficient to preserve the literal content. It does not itself
prove that the files identify one exact revision, reassessment, pair of executions and transported
certificate; enforce one unbroken event chain; reject a silently replaced artifact; or give a fresh
recipient one bounded checker-only replay operation.

### 2. Add one closed episode envelope above the accepted lifecycle

A small analysis-layer contract can embed the exact PR #51 transport record, derive all mathematical,
source, assumption, applicability, execution and certificate bindings through the existing public
interfaces, and add only supplied human declarations. A recipient can reopen the envelope, rederive
the bindings and freshly check every mathematical artifact while treating the authority basis,
decision, implementation, observation and reconsideration as preserved declarations rather than
freshly proved facts.

### 3. Add a workflow, case-management or outcome-evaluation system

A general system could assign work, authenticate authority, evaluate outcomes, infer effects, update
models and manage repeated episodes. One synthetic story supplies no evidence for that scope. It
would also blur the line between a portable provenance object and operational authority.

## Proposed decision

Propose option 2 for human review.

Add `decision-episode-v0.1.schema.json` and a small `@writ/shared-analysis` extension. The episode is
not a Core record, corpus object, workflow state machine or mathematical result. It contains one
exact certificate-transport record and a derived checked-history binding. That binding identifies:

- the shared-analysis archive, source and assumption basis;
- the substantive revision, revision impact and applicability reassessment;
- the target problem and query;
- the preserved original and successor execution bytes; and
- the preserved source and target certificate bytes.

The envelope then stores separate supplied objects for the authority basis, human or institutional
decision, implementation, observation, optional observation interpretations and reconsideration.
The decision must explicitly say that mathematics was considered but did not authorize the act.
Writ records the authority statement and bytes but does not authenticate them.

Observation objects have a closed shape with no causal, correctness or model-update field. Any such
claim belongs in a separate interpretation object with its own review state. Even an accepted
interpretation does not mutate the embedded analysis; a later mathematical revision must still use
ADR 0028's existing revision and reassessment operations. Reconsideration is an explicit supplied
trigger whose model effect is `none_automatic` and whose next step is human review.

`replayDecisionEpisode(...)` reopens the embedded record, rederives every identity, freshly checks
the original and successor decision executions, and invokes the PR #51 transport checker. It never
runs a producer. Its report separates fresh mathematical checks from hashes of preserved human
declarations and explicitly reports that it inferred no decision, causality, correctness or model
update.

## Bounded evidence

The first fixture exercises one story only:

1. alpha's old synthetic analysis freshly checks with action A strictly optimal;
2. the supplied X revision changes the exact subject and makes applicability stale;
3. an explicit supported reassessment permits the checked successor, where B is strictly optimal;
4. the exact PR #51 adapter checks a transported certificate for the revised request;
5. the synthetic board explicitly chooses A under a separately supplied authority statement;
6. a separate record says A was implemented;
7. a supplied observation reports a loss of 1 unit without causal attribution or evaluation;
8. the board explicitly requests reconsideration without updating the model; and
9. a producer-disabled recipient freshly checks the two executions and transport record.

The deliberate A decision after a checked B result is not an endorsement of A. It is a decisive
control demonstrating that Writ preserves a human act rather than deriving one from mathematical
optimality.

Compared with separate files, the envelope earns candidate provenance/reuse value from fail-closed
cross-artifact binding, deterministic identity, event linkage and one recipient replay boundary.
It earns no stronger mathematics or empirical conclusion.

## Consequences and limits

- The proposal reuses ADR 0026, ADR 0028 and PR #51 objects unchanged; it creates no second revision
  or applicability system.
- Evidence/source identities, assumptions, mathematical checks, applicability, authority, decision,
  implementation, observation, interpretation and reconsideration remain separate.
- Supplied actor and authority identifiers are not authenticated identities or permissions.
- Observation ordering does not establish that implementation caused the observation.
- Reconsideration does not revise a model; it records that a human review is required.
- No causal inference, automatic outcome evaluation, workflow engine, database, ontology, graph,
  solver registry, UI or autonomous decision-making is introduced.
- This build is not another Bellman transfer and authorizes none.

The implementation stops at this Proposed decision. A human must decide whether the replayable
decision episode should become accepted Writ architecture.


## Repair review addendum (9 September 2026)

Status remains **Proposed**. PR #53's repair authorization is not architecture acceptance.
The [repair review](../docs/experiments/decision-episode-repair-review.md) supersedes the original
build report's unrestricted substitution claim: whole-episode preservation requires a recipient's
independently retained expected hash. Internal references alone cannot reject a coherently rewritten
set of supplied declarations. Replay now requires that pin, validates real calendar instants and
rejects a freshly invalid source/target/transport warrant. No frozen episode bytes change.

Keep the useful decision/implementation/observation/reconsideration distinction. Vela inspiration
or overlap is not a reason to remove it: Vela Claim acceptance and Writ's supplied operational choice
have different meanings. No new Vela dependency is required. The PR #51-only profile is retained as a
bounded operation rather than generalized into a universal episode framework.

## Authorized external-evidence build (Proposed)

The user authorized an external producer and then linked episodes on this PR. The first checkpoint
adds `external-simulation-v0.1.schema.json` and a pure receiver for one pinned SimPy FIFO resource
profile. It retains source, model, input, runtime and output identities separately from native exact
mathematical checks. [Selection evidence](../docs/experiments/external-producer-selection.md)
records actual package/source inspection, execution, reuse and unsupported claims.
Simulation receiving establishes only finite trace agreement under supplied assumptions. Attaching
that evidence must not weaken the existing native transport profile or imply an empirical observation,
Bellman certificate, causal effect or authority. Both additions remain Proposed pending disposition.

## Authorized linked-pair build (Proposed)

`linked-episode-revision-v0.1.schema.json` adds one immutable pair whose parent reference resolves an
exact supplied observation and reconsideration, whose successor carries a newly checked external
run, and whose declared service-time change is the complete external input diff. Each observation
record embeds the labelled model-generated run itself. Native history remains unchanged and both
native episodes receive fresh producer-disabled checking. The pair cannot infer empirical validity,
causality, source acceptance, authority, model update or supersession.

The [current operation](../docs/current/external-and-linked-episodes.md) and
[build/review evidence](../docs/experiments/external-linked-episode-review.md) define this explicitly
bounded extension. This supersedes the earlier repair review's scope recommendation prospectively,
not its frozen evidence. Standalone episode behavior remains unchanged. Both new dispositions stay
Proposed until the user's architecture decision.

## Authorized simulation-to-decision build (Proposed)

The user later authorized the missing bounded connection from the external model to a decision
comparison. This does not amend the native certificate-transport subject or retrospectively add a
loss meaning to the earlier queue traces. `simulation-decision-v0.1.schema.json` defines a separate
exact subject containing a complete declared option menu, actual pinned FIFO runs, option-to-input
semantics, explicit units, supplied integer preference mapping, exact full minimizing set and
`not_established` empirical applicability.

`simulation-decision-revision-v0.1.schema.json` embeds two immutable comparisons and two immutable
episodes. It supports only a supplied base-service change with every derived option input/run
enumerated, requires unchanged option/objective/native-history semantics, and derives the relation
between each conditional preference and the separately supplied human decision. The successor may
select a modelled recommendation, another modelled action or an outside/deferred act; none is
generated by the checker.

Fresh receiving checks every external trace and exact objective arithmetic, then replays both
native episode histories with the producer disabled. It establishes no empirical service duration,
causal intervention effect, calibrated cost, real-world menu completeness, authority or automatic
adoption. Bellman's existing finite supplied-loss principles and Decision Lab's existing native
checkers are sufficient; this build adds no cross-repository mathematical warrant. The
[current contract](../docs/current/simulation-to-decision.md) remains part of this Proposed ADR and
requires the same explicit human architecture disposition as the rest of PR #53.
