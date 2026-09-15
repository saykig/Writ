# Architecture reset ledger — 15 September 2026

This file records what Writ had built before the decision-object reset, what we learned from it, and why some code was removed from the active repository.

Nothing listed here is being treated as a mistake. The earlier work answered real questions. The reset is about making the next version of Writ simpler and more general.

## Where the old state can be recovered

The complete repository immediately before this reset is Git commit:

`7f4f5b7c9f225c6c40e731d9f318da079704d45d`

PR #54 is the reset that moves away from that active architecture.

ADRs 0028 and 0029, plus the reports under `docs/experiments/`, remain in the repository as the detailed research record. ADR 0030 governs new decision work.

## What we built before the reset

### 1. Exact decision cases

Writ learned to preserve the exact mathematical problem, send it to a pinned engine, save the candidate result, and check that result separately.

This survives. `packages/decision-case/` remains as a narrow reference implementation.

Main lesson: **the calculation, the real-world fit of the model, and the human decision are different claims.**

### 2. Shared analyses and revision tracking

`@writ/shared-analysis` tried to answer a harder question: when two analyses share evidence and something changes, which old conclusions still apply and which need to be checked again?

It could preserve separate models, record an explicit source or assumption change, trace which calculations depended on that change, and require a new applicability decision before recomputation.

Main lesson: **"the world changed" and "the old mathematical conclusion stopped following from its assumptions" are not the same thing.** A changed input does not automatically make old mathematics wrong, but it can make an old answer unusable for the new situation.

Why the implementation is retired: it grew into its own lifecycle, archive format, lineage layer, replay system, and revision vocabulary around one narrow decision-case family. That is too much architecture to carry before Writ has a stable general decision object.

### 3. Certificate transport

The project tested whether a previously checked mathematical result could be carried through a declared model or policy change and checked again without pretending that stored success flags were authoritative.

Main lesson: **saved results are evidence of an earlier check, not proof that the result still applies now.**

Why the implementation is retired: the mechanism was tightly coupled to the shared-analysis archive and a specific Bellman/Decision Lab transition. The general lesson belongs in future engine adapters; the specialized transport contract does not need to remain active.

### 4. Decision episodes

Writ built a bounded object connecting:

```text
checked analysis
-> human or institutional decision
-> implementation
-> observation
-> reconsideration
```

The important separation was deliberate: the mathematical result did not authorize the decision, implementation did not have to equal the stated decision, and an observation did not automatically become a causal conclusion.

Main lesson: **a decision record should eventually be able to trace forward into what was done and what happened, without turning sequence into causation.**

Why the implementation is retired: the episode object depended on the whole shared-analysis and certificate-transport stack. The forward trace is still part of Writ's long-term direction, but it should be rebuilt later on top of the simpler decision object if a real case needs it.

### 5. External SimPy receiving

Writ used a real SimPy FIFO model rather than inventing its own simulator. It pinned the external model and package, received exact output, and independently checked the simple queue arithmetic.

Main lesson: **Writ should use established mathematical software and independently check what it reasonably can.**

Why the implementation is retired: this is exactly the pattern the new architecture wants, but the old code lived inside `@writ/shared-analysis` and was tied to the decision-episode experiment. It is cleaner to build future engine adapters from scratch around the new decision object than to preserve that coupling.

### 6. Simulation-to-decision comparison

The project mapped several actual simulation runs into a supplied objective, compared options, revised one assumption, reran the options, and kept the resulting mathematical preference separate from the human choice.

Main lesson: **an engine can rank or compare options under supplied assumptions without deciding what a person or institution should do.**

Why the implementation is retired: the objective, queue model, revision rule, and episode binding were intentionally narrow. Keeping them as a general Writ surface would make one experiment look like the architecture.

### 7. AFY 2024 RO-Crate handoff

Writ tested whether a real Bellman research result could be packaged, reopened by another tool, challenged for a new intended use, and returned with a linked assessment. The experiment deliberately did not copy restricted raw participant data.

Main lesson: **portable research handoff and decision representation are related but not the same problem.**

Why the implementation is retired: the handoff was useful interoperability research, but RO-Crate export, recipient workflow, dependency locking, and reimport logic are not necessary for the present decision-object core. The exact executed example remains recoverable from the pre-reset commit above.

## Audit of the deleted surfaces

| Deleted surface | Restore to active tree? | Reason |
| --- | --- | --- |
| `packages/shared-analysis/` | No | Too much lifecycle machinery tied to one narrow family; no longer the active architecture. |
| Shared-analysis / transport / episode / simulation schemas | No | They describe retired APIs and would falsely imply current support. |
| Shared-analysis revision fixtures | No | Useful experiment, but specific to the retired package; detailed reports and Git history remain. |
| Decision-episode fixture | No | The forward-trace idea survives, but this implementation depends on retired layers. |
| Linked-episode fixture | No | A special bridge between the old episode and SimPy profiles, not a reusable core primitive. |
| Simulation-to-decision fixture | No | Good proof of separation between model ranking and human choice, but too specialized to define Writ. |
| External SimPy fixture | No, for now | The adapter pattern is worth reusing, but the old code is coupled to the retired package. Rebuild a cleaner donor trial when the new object is ready. |
| AFY RO-Crate handoff | No | Valuable interoperability experiment, but outside the current core and expensive to keep as an active supported workflow. |
| Old current-doc pages for these systems | No | Keeping them under `docs/current/` would make retired architecture look current. |
| Old north-star diagram | No | It hard-coded the old source/Bellman/shared-analysis layering. Its useful ideas are retained here and in the new current docs. |

## What must survive the reset

The reset keeps these principles:

- exact inputs and outputs matter;
- use established mathematics instead of rebuilding mature solvers;
- check results independently where possible;
- do not confuse mathematical validity with empirical fit;
- do not confuse a model result with authority to act;
- record important assumption or evidence changes explicitly;
- know when a change requires recomputation or only a new applicability judgment;
- preserve the difference between an observation and an interpretation of that observation;
- eventually support a trace from decision to implementation and observed outcome;
- keep old states recoverable instead of silently rewriting history.

## Bottom line

The audit found **no deleted implementation that should be restored as an active Writ API today**.

Several ideas are worth keeping, and they are preserved above. The code should stay deleted because it would otherwise make the repository support two competing architectures at once: the old layered replay/revision system and the new engine-neutral decision object.

If a future proving case needs one of these capabilities again, start from the lesson and the pre-reset commit, then rebuild only the smallest part that the new case actually requires.
