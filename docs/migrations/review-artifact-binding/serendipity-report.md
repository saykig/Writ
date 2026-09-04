# PR 40: final bounded serendipity wedge

Audited exact head: `5e9882387c2f83ddafe9fac0d6a30f81a70665b7`.
The inline representation, NIST application boundary and human gate remain unchanged.

## Governed artifact closure

Synthetic fixtures used only harmless text. Existing authority was read first: AGENTS invariant
11, the product definition's frozen-input determinism, ADR 0020's mechanical integrity boundary,
the tracked checksum inventory implementation, and ordinary export's clean-commit requirement.

| Artifact state at the audited head | Full verification | Ordinary export | Same commit without local artifact |
| --- | --- | --- | --- |
| Untracked regular file | Passed | Rejected dirty tree | Verification and export failed |
| Ignored regular file under `dist/` | Passed | Passed; exact bytes embedded in 1.1 | Verification and export failed |

The ignored fixture and its clean checkout both reported clean Git status at the same synthetic
commit `185b5234b15fc550a90303e72f78f63883cee120`. Its local bytes changed whether that committed
snapshot could verify and export. This is a governed-artifact closure defect, not a hash failure.

The smallest correction requires the artifact to be Git-tracked through the shared repository
adapter. The existing integrity gate already requires tracked files in `MANIFEST.sha256` and
checks their bytes. Manifest membership alone would not establish Git membership for ordinary
export; a new registry or declaration is unnecessary. Candidate staged additions can verify,
while ordinary export still requires their clean committed state. The real NIST artifact is
already tracked and unchanged.

## Export amplification

Production projection, serialization and reload were measured using synthetic repository inputs;
these measurements did not bypass byte verification, but did not exercise the clean-Git CLI gate.

| Artifact bytes | Judgments | Embedded base64 bytes | Serialized bundle bytes |
| --- | ---: | ---: | ---: |
| 1,024 | 1 | 1,368 | 54,713 |
| 1,024 | 10 | 13,680 | 90,787 |
| 1,024 | 100 | 136,800 | 452,049 |
| 1,048,576 | 1 | 1,398,104 | 1,451,449 |
| 1,048,576 | 10 | 13,981,040 | 14,058,147 |
| 1,048,576 | 100 | 139,810,400 | 140,125,649 |

All six reloads passed. Duplication is linear: `N × 4⌈B/3⌉`. The largest sample took approximately
1.3 seconds to generate and 1.7 seconds to reload/validate on the test machine. End-of-sequence
RSS was about 1.24 GB; it was cumulative, not an isolated peak measurement. Large fanout is a
real transport/memory cost, but the actual 4,025-byte NIST artifact shared by two future judgments
would contribute only 10,736 base64 bytes. The bounded response is a declared transport limitation,
with no native or transport redesign in this PR.

## One independent discovery

The independent non-implementing pass found one additional binding-specific counterexample.
A bundle's unchanged whole native resource declared binding A, while the matching compiled
judgment, stored fragment and embedded bytes consistently declared B. After all outer hashes were
refreshed, reload accepted both conflicting declarations for the same judgment. The correction
compares only the new binding against the matching judgment in the existing routed resource;
it does not attempt general source/projection equivalence.

## Final acceptance

The post-repair ordinary CLI replay rejected the same ignored artifact with
`PROVENANCE_REVIEW_ARTIFACT_NOT_TRACKED` in both full verification and clean export. An ordinary
untracked artifact also failed verification; the existing dirty-tree gate still rejected export.
After force-tracking the harmless ignored-path artifact and updating the existing manifest, full
verification and export passed. Its clean clone at the same synthetic commit
`3078966e8e3a60497e0c1c9029bcc2542937735b` also passed and produced byte-identical bundle JSON.

The independent whole-resource counterexample was replayed unchanged: its consistent control
passed, then its contradiction failed with `review binding disagrees with whole judgment resource`.
Regression tests additionally preserve a coherently updated binding and reject binding stripping
while the routed whole source still declares it.

Local formatting, lint, typecheck, all 533 Bun tests, the packed external Node consumer, all four
verification gates and build passed. The 21 database-dependent tests remain skipped locally.
The old unbound fixed-commit export remains byte-identical at 1,532,537 serialized characters.
All 194 protected corpus, compatibility, NIST review and old judgment/bundle schema files remain
byte-identical; main remains clean at the original baseline.

No NIST successor judgments, persistent-agent framework or merge are included. The native inline
contract and bundle version remain unchanged. Clean-commit export and CI checks attach to the
repair commit on the existing PR.

Verdict after the decisive repairs: `READY_FOR_HUMAN_DISPOSITION`.

Next action: supply one explicit disposition on the two proposed bound successor judgments in
[the existing human-review packet](human-review-packet.md).
