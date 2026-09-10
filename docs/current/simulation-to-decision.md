# Bounded simulation-to-decision connection

**Status: Proposed under ADR 0029 and PR #53; neither merged nor architecturally accepted.**

This operation closes one deliberately small gap in the prior external-simulation example: it maps
several actual model runs into a supplied objective, compares a complete declared menu, preserves a
base-assumption revision and rerun, and binds the resulting conditional preferences to separately
supplied human decisions. It remains separate from the native A/B certificate-transport subject.

## Comparison subject

`simulation-decision-v0.1.schema.json` governs `simpy-resource-fifo-decision.v1`. One comparison
binds:

- the exact pinned SimPy model/source/runtime profile already received by Writ;
- one supplied base service duration and deterministic arrival list in minutes;
- 2–8 lexically ordered options, each with an identity, human-action identity, description,
  service-duration delta, exact fixed cost and exact external run;
- a complete declared menu plus `not_established` real-world option completeness;
- exact minimization of `wait_weight * total_wait + fixed_cost`;
- the model-output unit, loss unit, conversion weight, preferences, rounding and tolerance; and
- derived per-option losses, the complete minimizing option set and empirical/applicability limits.

The supported objective uses integer minutes, a positive integer weight in
`stipulated_loss_point_per_minute`, fixed costs in `stipulated_loss_point`, no rounding and zero
tolerance. These loss points are supplied preferences. They are not empirically identified welfare,
money or a native Writ record. Other mappings or units are unsupported rather than silently coerced.

`openSimulationDecisionComparison(bytes, expectedSha256)` requires an independently retained whole-
comparison hash. It reopens every exact external run through `receiveExternalSimulation`, checks the
scenario-to-option input mapping, freshly recomputes total waiting through the independent FIFO
recurrence, and then recomputes every loss and the full minimizing set with BigInt arithmetic. A
single minimum is `unique_minimum`; multiple minima are `exact_tie`. An unreceived, incomplete or
unsupported artifact is never translated into a tie or false preference.

The returned assurance keeps fresh trace agreement and exact objective arithmetic separate from
false empirical-validation, objective-identification, causal, Bellman-certificate and authority
claims. `applicability_status` is `not_established` even when the arithmetic checks.

## Revision and episode binding

`simulation-decision-revision-v0.1.schema.json` governs one parent/successor pair. It embeds both
exact comparisons and both exact decision episodes, resolves every named decision/observation/
reconsideration event, and requires unchanged native mathematical history. This profile supports
one declared change: `base_service_minutes`. Scenario identity, arrivals, units, option semantics,
option deltas, fixed costs, objective and menu scope must remain identical.

Every option is rerun at `successor base + declared delta`. The revision lists every old/new run,
input and service value. A numerically valid comparison with another changed option description,
arrival, cost, mapping or omitted rerun is therefore outside the declared change and rejects. The
old comparison and episode remain immutable.

Each comparison must precede its episode's supplied decision. The parent reconsideration precedes
the declared revision; the successor rerun follows it and precedes the successor decision. These
times and actor identifiers are supplied provenance, not authenticated execution or identity.

The relation derives whether the episode selected a recommended modelled option, another modelled
option, or an outside/deferred action. It copies no action into the episode and grants no authority.
`replaySimulationDecisionRevision(...)` freshly checks both comparison subjects and both native
episode histories with producers disabled, returning the checks, ranking change, supplied human
dispositions and `not_established` applicability separately.

## Demonstrated case and boundaries

The [synthetic charging-process example](../../examples/decision-cases/simulation-decision/README.md)
uses three options and actual deterministic SimPy runs. Under the supplied scale, revising base
service from 5 to 9 minutes changes the conditional unique minimum from `retain` to `intensive`.
The successor human act defers adoption and requests empirical evidence. This is an executable
control proving that conditional preference is not authority or automatic choice.

No sampling, prior, probability, causal effect, real service improvement, calibrated cost,
real-world option completeness, strategic response, source acceptance, automatic model update,
supersession, workflow engine or deployment is introduced. A future stochastic, robust, causal,
constrained or multi-objective comparison needs the relevant Bellman semantics and a separate
bounded transfer.
