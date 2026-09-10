# External simulation evidence and one linked episode revision

**Status: Proposed under ADR 0029, PR #53; neither merged nor architecturally accepted.**

This addition receives one real external SimPy result and resolves one explicit successor episode.
It retains the repaired standalone episode contract unchanged. It adds two closed operations rather
than making simulator outputs conform to the native certificate-transport profile.

## External receiving

`receiveExternalSimulation(raw, { runSha256, inputSha256 })` verifies the intended run/input identities,
the pinned package-source manifest and model adapter, strict exact JSON and the supported input/output
shape. It independently checks every queue start/finish by an integer recurrence. Its return separates
integrity, format, analytical agreement, execution authentication, empirical validation and Bellman
certification; the latter three are false. No embedded model source is executed by receiving.

The supported profile is SimPy 4.1.1, two initially empty identical FIFO servers, strictly increasing
integer arrivals, constant positive integer service, minutes, no abandonment and no randomness.
There are 1–64 jobs. Arrival/service strings have bounded size; calculations use BigInt. The real
producer and reproduction instructions live in [the source-bound example](../../examples/external-simulation/simpy-resource/README.md).
Changing package/model/assumptions outside that profile is unsupported, not silently compatible.

## Resolved pair, not an episode graph

`createLinkedEpisodeRevision(parentBytes, successorBytes, declaration)` composes a portable pair.
`openLinkedEpisodeRevision(bytes, { linkSha256, parentSha256, successorSha256 })` resolves both exact
native episodes and the parent's named observation and reconsideration. Each episode's observation
record must itself contain a checked external-run envelope with `evidence_kind: model_generated`.
Thus extracting a standalone episode preserves the structured simulation label inside its record.
Free-text descriptions remain supplied statements and are not semantically authenticated.

The declared external revision identifies both run/input hashes, old/new service durations, reason,
actor and supplied time. Receiving verifies the complete input diff: only `service_minutes` may
change; arrivals, units, model and package must remain supported and identical. The revision must
follow the parent's reconsideration and precede the successor decision. Episode times are supplied
synthetic provenance, not verified execution dates. A new input without a corresponding numerically
valid new trace rejects; so does a valid trace with an undeclared extra arrival change.

Native checked history must remain identical in this external-only profile. There is no new
queue-to-loss mapping, reassessment, native subject revision, source acceptance or certificate
transport inferred by the link. A different native model requires the existing revision operations
and a separately warranted integration; this pair does not claim to support that operation.

`replayLinkedEpisodeRevision(bytes, pins, engineOptions)` additionally invokes the existing
producer-disabled native receiver for both episodes, rechecking both original/successor executions
and source/target/transport warrants. It returns these checks separately from external trace checks.
A saved receiving report is evidence of an earlier run, never receiving authority.

The actual example is [linked charging-planning episodes](../../examples/decision-cases/linked-episodes/README.md).
The relationship is explicit reconsideration, with `supersession: none_automatic`; both episodes stay
immutable. It does not schedule work, infer a causal effect, authenticate authority, update a model
or automatically accept a later choice. No arbitrary graph, registry, workflow service or UI exists.

## Pins and limits

Expected pins must come from the intended reviewed handoff independently of the received bytes.
Refreshing all hashes can create a different structurally valid object; it cannot establish original
authorship or truth. The local producer checks installed SimPy sources and uses fixed source/input
snapshots; the trusted interpreter/environment/OS and absence of concurrent installed-package
mutation remain prerequisites. The receiver verifies the recorded identity, not that a remote
machine really ran that package. A recorded actual execution plus numerical reproduction and
independent analytical agreement have different assurance scopes.

The example's native A/B cost history is deliberately separate from simulated waiting time. Neither
minute-to-loss conversion nor empirical applicability is assumed. The synthetic board commissions
simulation only and subsequently asks for real service-time evidence; nothing is deployed.
