# Bounded decision episodes

## Status and boundary

`decision_episode` is a **Proposed** analysis-layer contract awaiting the ADR 0029 human architecture
gate. It tests whether Writ can close one provenance loop after a checked mathematical transition:

```text
checked analysis
-> explicit human or institutional decision
-> implementation
-> observed consequence
-> explicit reconsideration
```

The episode does not convert a mathematical result into authority, convert an observation into a
causal claim or evaluation, or create a new model revision. It reuses the exact accepted
decision-case, shared-analysis, revision, applicability and PR #51 transition boundaries.

## Contract

`schemas/analysis/decision-episode-v0.1.schema.json` is a closed JSON Schema 2020-12 envelope. The
public implementation lives in `@writ/shared-analysis` because the new object composes that
package's accepted archive and transition rather than owning another provenance graph.

The envelope has seven deliberately separate parts:

1. `checked_history` embeds one exact PR #51 transport record and derives its shared archive,
   revision, reassessment, source, assumption, problem, query, original/successor execution and
   certificate identities.
2. `authority_basis` is a supplied statement and exact artifact. Writ preserves but does not
   authenticate it.
3. `human_decision` is a required supplied act. Its selected action is never calculated from the
   checked result, and `mathematical_role` is fixed to `considered_not_authorizing`.
4. `implementation` independently says what was reportedly implemented. Writ does not silently
   force it to equal the decision.
5. `observation` preserves one supplied consequence record after implementation.
6. `interpretations` optionally hold causal attribution, decision evaluation or model-update
   proposals. Each is separate from the observation and has its own review state.
7. `reconsideration` is an explicit trigger tied to the observation. It has
   `model_effect: none_automatic` and sends the next step to human review.

Exact UTC event strings enforce the order decision -> implementation -> observation ->
reconsideration. Ordering is provenance only; it is not causal identification.

## Public operations

- `createDecisionEpisode(transportBytes, declaration)` derives the exact checked-history binding and
  requires every later declaration as input.
- `decisionEpisodeBytes(episode)` emits deterministic exact JSON.
- `openDecisionEpisode(bytes)` validates the authoritative schema, every embedded byte hash, the
  transitive Writ bindings, event references and ordering.
- `replayDecisionEpisode(bytes, engineOptions)` freshly rechecks the original and successor
  executions plus the transported certificate. It returns preserved declaration hashes separately.

The recipient command is:

```bash
bun packages/shared-analysis/bin/writ-decision-episode.ts replay \
  --episode /path/to/episode.json \
  --engine-root /path/to/pinned/writ-decision-lab \
  --python /path/to/cpython-3.13-with-scipy-1.17/bin/python
```

Replay uses the existing checkers and does not run a producer. The report's
`automatic_inferences` fields remain false even when a separately declared interpretation exists;
the interpretation and its review status remain inspectable instead.

## First story and limits

The runnable synthetic fixture is under `examples/decision-cases/decision-episode/`. It preserves
one old alpha execution, one substantive revision and stale-applicability finding, one explicit
reassessment, one successor execution, one PR #51 transported certificate, one supplied decision,
one implementation, one observation and one reconsideration trigger.

The fixture intentionally records a human choice of A after the successor mathematical result says B
is strictly optimal. That proves only that decision supply is separate from mathematical checking.
It does not say that A was wise, authorized in reality or caused the later observation.

ADR 0029 proposes retaining the narrow semantic `replayable decision episode` because the envelope
adds exact cross-artifact binding and recipient replay that loose files do not enforce. It remains
unaccepted until the human architecture gate. No workflow, causal, evaluation, model-update,
authentication or authority-to-act semantics are earned.
