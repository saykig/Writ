# PR #53 repair review

## Verdict and architecture disposition

**Keep after repair, with the current narrow profile.** The envelope gives a recipient one pinned
handoff from checked/revised analysis to supplied choice, implementation, observation and
reconsideration. It does not establish authorship, legitimate authority or empirical truth. This is
useful Writ functionality even where Vela has related provenance concepts. Recommend accepting the
bounded architecture in ADR 0029 after the user reviews this scope; the ADR remains Proposed and
PR #53 remains unmerged. Validation completion is recorded separately below, not presumed by this
recommendation.

## Actual review findings and repairs

Reviewed initial head `b1f950ef380d4476cbb0f3d6173a6f20fb86c96f`, then merged remote main
`c09922f8a4689284de42b1b1bcc22098fa19c117` without rewriting history. Merge checkpoint `8ff1011`
retains the completed assessment pilot, Vela evidence, moonshot guidance and CPU-only hosted CI
installation. The old hosted failure log (run 34403338424) actually reports disk exhaustion in both
Python-install jobs; no skipped test or application failure was relabelled as passing.

Three concrete repairs:

1. A coherently rewritten declaration or entire substituted episode passed internal validation.
   That is not evidence of historical preservation. Recipient replay now requires an independently
   supplied expected episode SHA-256. Opening without a pin remains explicit structural inspection.
   Tests preserve this boundary: a changed but internally valid episode opens under its new identity,
   but rejects against the prior pin. A pin obtained from the attacker alongside the file is not
   protection; external authority for the pin is assumed, not invented.
2. The timestamp regular expression admitted nonexistent dates. Validation now rejects invalid
   calendar instants and retains the bounded UTC, whole-second, strictly ordered profile. A real
   leap-day positive control distinguishes this from simply restricting date strings.
3. The lower-level transport receiver correctly returns independent source, target and transport
   statuses, including rejection. The episode CLI previously returned success even when transport
   replay rejected. Episode replay now requires the full warrant and both exact executions. A real
   producer-disabled negative test alters transport evidence, refreshes its hash and the stored
   success binding, and reconstructs the episode. Structural opening still succeeds; fresh episode
   receiving rejects with `DECISION_EPISODE_REPLAY_INCOMPLETE`, preserving the transport diagnostic.

The prior build report and frozen episode remain historical evidence. Its unrestricted substitution
claim is narrowed by this addendum. No check authenticates the human declarations or interprets
opaque authority/implementation/observation text. A closed schema prevents structured promotions,
not false sentences. A declared accepted interpretation is still a supplied actor review; it is
neither Vela Claim acceptance nor authorization to modify a mathematical model.

## Binding trace and useful behavior retained

The episode opens the existing transport record, which reopens the native shared-analysis archive,
rederives the substantive revision impact and exact supported reassessment basis, and binds the
request, source/target certificates and stored evidence. The episode derives source/assumption,
problem/query and original/successor execution identities from those public objects. A human choice
then references that history binding and a separately supplied authority basis. Implementation,
observation and reconsideration reference the preceding declarations. The whole-episode pin covers
all declarations and artifacts, including their IDs, byte hashes and text.

Fresh receiving reuses the native original/successor execution checker and transport checker; it
never runs a producer. The story retains A as the human choice after the revised mathematics says
B. A separate positive control allows implementation to differ from the choice. Authority-holder
and actor strings are preserved without pretending they establish delegation. Temporal order is
supplied provenance, not causality. Observations and reviewed interpretations leave mathematical
bytes untouched; reconsideration requires another human step, not an automatic revision.

## Bounded profile and maintenance assessment

The required transport record is a deliberate profile restriction, not a fixture ID coupling:
production validation has no alpha, X, A or B special case. It reuses the accepted revision and
reassessment contract and the reviewed PR #51 transport contract. It cannot represent an ordinary
decision without transport, multiple implementations/observations, or repeated reconsideration.
Retain those explicit limits until a concrete operation warrants another contract. Generalizing now
would enlarge dispatch, schema and assurance obligations without evidence of benefit.

The added maintenance surface is one closed schema, one TypeScript declaration mirror, four public
operations (create/serialize/open/replay), one CLI, four diagnostics, and focused tests within the
existing shared-analysis package. It introduces no new dependency, service, storage, solver or
provenance graph. Exact JSON, byte encoding/hashing, native lifecycle and both checker boundaries
are reused. Some schema/type repetition and duplicated derived history fields are real costs: a
change to upstream binding shape requires updating this projection, schema/types and its tests.
Recipients rederive these fields so they cannot become a second source of mathematical authority.
The new required replay pin also exposed a generator's incidental use of a replay-options type;
that generator now uses the existing transport-engine type without changing generated bytes.

The smallest justified simplifications are to keep that explicit profile and reuse existing
receivers. Removing implementation/observation/reconsideration merely because of Vela overlap would
remove the operation being evaluated. A new Vela adapter, generic governance layer or universal
episode framework would add maintenance without helping this tested operation. The completed
Writ–Vela pilot remains evidence about pending Submissions and scoped Verification, not accepted
Claims or operational decisions.

## Validation

Focused unit checks: 10 passed (47 assertions). Real episode integration: 2 passed, zero skips,
including relocated producer-disabled positive receiving and false-transport rejection. The
synthetic fixture regenerated byte-for-byte; its retained original stays unchanged. Combined
repository and inherited real integration acceptance is being run on the repaired source; final
results and exact source checkpoint will be added without rewriting previous evidence.
