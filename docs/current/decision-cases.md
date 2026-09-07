# Derived decision cases

## Status and boundary

The bounded derived decision-case layer is a review candidate governed by proposed ADR 0026. It is
separate from Writ's political-knowledge records and does not change the two implemented native
families or the NIST proving ground.

A case can preserve an intended mathematical question, explicit supplied content, modelling choices,
deterministic transformations, exact mathematical subjects, checked candidate artifacts,
dependencies and immutable revisions. It cannot establish that its premises describe reality,
accept evidence, approve a review, select an authority, or authorize action.

## Versioned contracts

- `schemas/analysis/decision-case-v0.1.schema.json` governs one portable case snapshot.
- `schemas/analysis/decision-execution-v0.1.schema.json` governs one candidate and the check recorded
  by its runner.
- `@writ/decision-case` provides the corresponding pure validation/identity/revision interface and
  the explicitly invoked runner/consumer interface.

The first adapter is closed to Decision Lab commit
`7215b53096bc487756f94f4ca87390716a14f2ee`,
`finite-linear-uncertainty.v1`, CPython 3.13 and `scipy==1.17.0`. Its only enabled operations are
`decision` and `compatibility`. Unknown versions and operations are errors, not aliases to a nearby
calculation.

## Identity and checking

Problem, query and candidate-result bytes are stored as canonical base64 plus SHA-256. Consumers
decode and pass those exact bytes to the pinned interface. Exact rational strings, state order,
loss rows, family kind and raw Unicode therefore survive Writ without ECMAScript-number conversion or
Writ Canonical JSON normalization. This does not change Writ's historical canonical profile.

Small supplied text fixtures use Writ's existing source/version/reference and exact-byte hashes. The
decision-case validator additionally compares the declared quote with the actual UTF-8 bytes at its
declared start/end offsets. A quote hash alone is insufficient.

The runner never trusts a solver status as a conclusion. It first obtains a candidate, then starts a
separate exact-check invocation with the independently supplied intended problem/query bytes. The
portable execution stores the candidate and observed checked projection, but a recipient treats both
as untrusted and invokes the exact checker again after reload. A case cannot supply an executable,
module path, shell fragment or other command.

## Dependencies and revision

Every represented family kind, state order, equality or inequality row, requested operation, unit and
action loss row has an explicit dependency mapping. Dependencies distinguish `source_support`,
`model_construction` and `checked_mathematical_use`; their bounded graph must be acyclic. These edges
mean “used by this derivation,” never statistical dependence, independence or causality.

`assessReuse` compares exact problem/query hashes separately from the source-reference fingerprints
used by an analysis. A loss, constraint or query change prevents reuse of the prior mathematical
check. A source-only change can leave the old mathematical statement correct for its old bytes while
requiring reassessment of applicability. Unrelated case content does not change a mathematical
subject hash.

Execution and consumption always report mathematical status, applicability and human disposition as
separate fields. The supplied fixture remains `unreviewed`; no reviewer is invented.

## Runnable fixture

`decision-cases/synthetic-failure-choice/synthetic-failure-choice.case.json` is one self-contained
portable fixture with three static revisions and an interpretation control. It is synthetic supplied
mathematics, not NIST data or an empirical estimate. Its directory README gives the local commands.

The alternative control retains revision 1 and revision 2 as separate scenarios. It does not weight,
average, intersect or convexify them. The simultaneous control explicitly asserts both disjoint A
bounds and asks only whether that conjunction is compatible.

The profile does not support conditional decisions, sequential policies, causal effects, safety
certificates, acquisition decisions, model weights or authority-to-act conclusions. Revision means a
new version of a static problem, not a sequential decision process.
