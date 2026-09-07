# Executable decision-case integration report

## Disposition

**Working bounded integration, proposed for human review.** The local implementation, real pinned
backend/checker run, fresh recipient replay and regression suite demonstrate the specified narrow
case. This is not a novelty, scientific-validity, productivity or product-success finding. ADR 0026
remains proposed and the PR remains unmerged.

## Exact authorities and pins

- Writ branch base and GitHub `main` at start:
  `20f0473afa62ed3c6e0433a21b189d1d9d1712d6`.
- Writ Decision Lab Build 2 merge commit:
  `7215b53096bc487756f94f4ca87390716a14f2ee`; reviewed PR head
  `123043d3eb3ded1cca36e3003d198512dd533446`.
- Bellman finite joint-law completion merge commit:
  `b1266137f824dc65e614722f1f0592846b915262`; repaired PR head
  `efba25bc3a52535e331fe21fe364f394029c853c`.
- Decision Lab Build 2 itself reports its mathematical derivation from Bellman commit
  `63a741fce5bb1457f8ae7bf6edbe95dbeaaf52ef`, principally the original build-out sections 3, 4.1–4.3
  and 15. This Writ integration additionally checked the later merged Bellman completion above for
  subject/witness/bound/original-domain distinctions and v1.1 composition/revision rules.
- Runtime used for the observed execution: CPython 3.13.15, `scipy==1.17.0`, Decision Lab source
  obtained from the pinned GitHub tarball into an ephemeral local directory. No local Decision Lab or
  Bellman checkout was read or modified.

## Implemented mathematical subject

The ordered worlds are `(A fails,B fails) = (0,0),(0,1),(1,0),(1,1)`. The exact family has
nonnegative masses summing to one, explicit marginal bounds for `a=P(A fails)` and `b=P(B fails)`, and
no other dependence constraint. The two loss rows use one fictional cost unit:
`risk(A)=1+L*I(A fails)` and `risk(B)=3+L*I(B fails)`.

The risk difference is therefore `risk(A)-risk(B) = -2 + L(a-b)`. Writ does not use that formula as
a shortcut. The external producer generates pairwise candidates and the external exact checker
verifies primal witnesses and dual bounds against the complete raw problem/query bytes. The reported
range below is reconstructed from the checked maximum of `A-B` and the negative checked maximum of
`B-A`.

| Analysis | Supplied change | Exact checked range of A−B | Checked decision meaning |
| --- | --- | --- | --- |
| revision 0 | `a∈[1/5,2/5]`, `b∈[1/20,1/10]`, `L=4` | `[-8/5,-3/5]` | A uniformly strictly optimal |
| revision 1 | only `L=10` | `[-1,3/2]` | model-dependent; no common optimal action |
| revision 2 | only `a∈[3/5,4/5]`, retaining `L=10` | `[3,11/2]` | B uniformly strictly optimal |
| simultaneous control | both disjoint A intervals asserted together | not applicable | exact family incompatible; checked contradiction `-1` |

The alternatives control retains revisions 1 and 2 separately. It does not intersect them, assign
weights, construct midpoint probabilities, convexify their union, or manufacture a minimax choice.

## Observed handoff and failure evidence

The pinned integration test executed all four subjects. A separate recipient process reopened only a
relocated case bundle and revision-1 execution artifact, then freshly checked the candidate and
returned `model_dependent`. It had no access to the author's original case directory, untracked
inputs or chat history; the explicitly supplied Writ runtime, pinned engine root and Python runtime
were its declared prerequisites.

Observed controlled refusals include:

- revision-0 execution presented for revision 1 (stale case/revision binding);
- changed problem/query hashes;
- a mathematically false objective with otherwise plausible metadata/hashes;
- a missing exact certificate;
- source-reference/actual-span mismatch;
- undeclared model input, dependency cycle, unsupported semantics and unsupported operation;
- missing engine root; and
- reinterpretation of the static expected-loss result as another declared use.

A source-only fixture revision left the raw mathematical bytes unchanged. The revision comparison
kept the old mathematical check reusable for its exact subject while separately reporting the
changed source-support dependencies and requiring applicability reassessment.

## PR 43 targeted hardening evidence

Hardening began from clean local and remote PR head
`42a960d7efdf0f0f8db27d469ea6681276abab9f`, whose merge base and then-current GitHub `main` were
both `20f0473afa62ed3c6e0433a21b189d1d9d1712d6`. The real public package reproduced the review
findings before repair: it accepted a missing analysis `kind`, a numeric accepted reviewer, an
unknown case property and a partial execution; it also missed mapping-only, unit-only and U+0001
delimiter-collision changes in reuse assessment. The full analysis binding already rejected the
changed mapping at consumption, so this was inconsistent reuse advice rather than a false
mathematical-certificate acceptance.

The repaired public loaders compile the authoritative case and execution schemas directly, reject
duplicate outer JSON keys and bound raw envelope size/depth before recursive validation. Existing
byte-hash, source-span, cross-reference, dependency-DAG, operation/use and exact-check rules remain
separate. A structurally valid reviewer declaration is still not reviewer authentication.

Reuse assessment now compares collision-free structured source/reference/dependency identities,
complete mappings, and semantic context including question, unit and intended/prohibited use. It
reports human-disposition changes separately. Identical raw mathematics can remain mathematically
reusable while changed support, mapping or context requires applicability reassessment. An unrelated
case title remains harmless. A human-disposition-only advance does not invalidate the old checked
theorem; consumption returns the current declared disposition while still freshly checking the
candidate.

Before launching Python, Writ now verifies all 16 repository-owned modules in the actual import
closure: eight Build 2 files plus the parent initializer and the seven Build 1 modules it imports.
The fixed bridge runs with Python isolated mode, inserts only the verified source root, and checks
the CPython implementation and 3.13 major/minor. A disposable-copy test changed the parent
initializer to write a sentinel; Writ returned `DECISION_CASE_ENGINE_PIN_MISMATCH` and the sentinel
was never created. A separate Build 2 checker drift was also rejected. The remaining trusted runtime
boundary is CPython and its standard library, the OS/process environment, and the installed
`scipy==1.17.0` distribution used for candidate search; checking itself remains exact and does not
need SciPy.

`bun run test:decision-integration` is the explicit no-skip acceptance command. With both
prerequisites absent it exited 1 with a named prerequisite error (0 passed, 1 failed, 1 loader
error). Against the pinned source and `/tmp` virtual environment it ran on CPython 3.13.15 with
`scipy==1.17.0`: 15 passed, 0 failed, 132 expectations. That run included all four mathematical
subjects, relocated recipient checking, stale inputs, changed support/mapping/unit, false and missing
certificates, both pin-drift controls, unsupported use, and a nonfunctional unresolved result. The
local adapter boundary separately rejected `/usr/bin/python3` (CPython 3.9) with
`DECISION_CASE_ENGINE_UNAVAILABLE` and `unsupported_python_runtime:CPython:3.9`. The offline package
run remained explicit: 14 passed, 0 failed, 1 integration skip, 88 expectations. The same pinned
environment reran the direct baseline for revisions 0–2 and reproduced the original three statuses.
No checked-in execution artifact was rewritten.

## Equal-assurance direct comparison

`direct_baseline.py` received the same portable case, selected revision, pinned engine source and
Python environment. It called the same upstream `produce`, exact `check` and `consume` functions.
It reproduced the three decision statuses. The baseline was not weakened to make Writ look safer.

| Observed dimension | Direct script | Writ-owned boundary |
| --- | --- | --- |
| Commands for one author calculation and recipient use | one direct command when author and consumer are the same process; a recipient must rerun or receive an added script/result convention | one `run` command plus one separate `consume` command |
| Declared runtime inputs | case path, analysis ID, pinned source on `PYTHONPATH`, Python environment | case path, analysis ID, explicit pinned engine root, Python executable; execution artifact for recipient |
| Successful answers | same three exact checked decision statuses | same three exact checked decision statuses |
| Failed handoff exercised | upstream checker refuses stale bytes if the direct caller supplies them correctly | case/revision/hash binding refuses revision-0-to-revision-1 reuse before fresh checking; checker then remains mandatory |
| Extra maintained interfaces | one small Python script | two JSON Schemas, TypeScript library/CLI, fixed Python bridge and dependency/mapping contract |
| Explicit guarantees observed | exact upstream producer/checker/consumer result for supplied bytes | same mathematics, plus actual-span checking, complete input-origin mapping, DAG/revision impact, separated applicability/review status and portable case/execution binding |

The competent direct route is clearer and mathematically equally adequate for this single case. The
Writ layer's demonstrated benefit is narrower: it makes the additional provenance, revision and
handoff safeguards one reusable checked interface. No human study supports a usability, adoption or
productivity claim.

## Commands and limits

Focused commands run successfully during implementation:

- package typecheck and lint;
- package unit tests without an external engine (integration test explicitly skipped);
- explicit package integration with the exact pinned engine/runtime (15 passed, 0 failed);
- four CLI `run` invocations and a relocated CLI `consume`;
- direct baseline for revisions 0, 1 and 2;
- Writ verification after the first implementation commit.

The final required repository commands all passed locally on the review branch:

| Required command | Result |
| --- | --- |
| `bun run format` | PASS |
| `bun run lint` | PASS |
| `bun run typecheck` | PASS |
| `bun run test` | PASS |
| `bun run data:check` | PASS; 81 records, 16 links, 65 judgments; byte-identical |
| `bun run verify:writ` | PASS; ontology, interoperability, provenance and integrity |
| `bun run build` | PASS |

The first aggregate-test attempt used an artificially narrowed local `PATH` that hid `npm` from the
existing provenance packed-package test. Repeating the same repository command with the normal
local toolchain available passed. The first final verification run also correctly rejected two
updated files until their tracked-tree checksums were refreshed; the repeated verification above is
the passing final result.

Limits inherited from the pinned engine include small finite rational linear families, at most 32
states, bounded rows/actions/input size, candidate search through floating SciPy/HiGHS followed by
exact rational checking, and conservative `unresolved` when usable evidence is unavailable. The
integration does not establish real-world membership, empirical support, formal verification,
conditional calculation, causal identification, sequential guarantees, safety, or authority.
