# Exact review-artifact binding

The `REVIEW-ARTIFACT-BINDING-001` implementation candidate declares an association between a
native judgment and exact artifact bytes. It does not verify human identity, approval, semantic
agreement, evidentiary sufficiency, or truth. The explicit 2026-09-04 human disposition authorizes
the two NIST bound successor judgments. Their prior unbound judgments remain preserved as
superseded history; the original review artifact bytes are unchanged.

## Representation and versions

Native judgment `0.3.0` permits one optional property:

```json
"review_artifact": {
  "path": "docs/migrations/example/human-review.yaml",
  "content_hash": "sha256:<64 lowercase hexadecimal digits>"
}
```

The locator and content identity are distinct. The property is independent of `evidence_refs`,
evidence basis, `reviewer`, judgment `status`, target review state, and truth. Multiple judgments
can share an artifact while retaining their own targets and succession histories.

Source dialect `writ 0.3` selects the new judgment contract explicitly and retains the existing
record contracts. Older dialects and judgment `0.2.0` are preserved; payload fields never silently
select a new contract. Old unbound judgments are not migrated or reclassified.

## Governed byte and path boundary

SHA-256 covers the complete file bytes. Hashes must use `sha256:` followed by exactly 64 lowercase
hexadecimal digits. There is no text parsing, character normalization, whitespace normalization,
or newline conversion.

The locator is a canonical POSIX path relative to the selected repository. Absolute paths, empty
segments, `.` and `..`, backslashes, ASCII controls (including DEL), unpaired Unicode surrogates,
colons and percent-encoded aliases are unsupported.
Filesystem resolution rejects symlink components, directories and other non-regular files,
missing files, paths outside the repository, and the judgment's own source file. Repository root
resolution does not authorize an artifact outside that root. Locator spelling is never silently
normalized to rescue an invalid binding.

The artifact must also be Git-tracked in the repository's candidate index. Matching untracked or
ignored local files cannot supply provenance for the governed snapshot. Existing repository
integrity checks cover the tracked `MANIFEST.sha256` inventory; ordinary export additionally
requires a clean committed tree. No separate artifact registry is introduced.

The shared pure verifier compares supplied bytes with the declared identity; the explicit
repository adapter supplies bytes under the same governed path rules for repository verification
and export. No network, inference, random value, clock read, or mutation is involved in checking
the association.

An empty regular file with the correct empty-byte hash is content-valid. An extraction report or
another review file with its own correct locator/hash is also a valid content association. Neither
case establishes that the file is the appropriate review. With an unchanged expected binding,
different bytes fail; moving identical bytes away from its declared path leaves a missing artifact.
An independently declared authorized in-repository path to identical bytes is a different locator
association, not an identity failure. Unauthorized paths and aliases fail regardless of matching
bytes.

## Portable export and reload

Binding-capable bundles use format `1.1.0`. Each judgment retains its native
`compiledJudgment.review_artifact`; a bound entry also carries
`reviewArtifact: { "encoding": "base64", "content": "..." }` with exact bytes. Locator/hash are
not duplicated in that transport envelope. Consumers can identify the judgment, artifact path,
expected hash, and available bytes independently.

Ordinary export resolves and verifies the binding before producing the bundle. Reload validates
the transport encoding and recomputes the content hash; refreshing bundle section hashes cannot
repair substituted artifact bytes. A bound export must include its artifact bytes. An unbound
judgment must not acquire an implied binding from a transport envelope. Old format `1.0.0` remains
supported, and entirely unbound repositories retain their original export representation. The
authorized NIST application selects format `1.1.0` for the current repository.

Reload also compares the new binding with its stored native judgment fragment using exact path
and hash strings, and with the matching judgment in its routed whole native resource. Changing
the advertised format or contract cannot strip a binding still declared by that source. This
scoped check does not establish complete source/projection equivalence for
unrelated fields or older contracts.

A standalone judgment may declare a hash when bytes have not been supplied to the consumer.
That consumer may report the declared association and unavailable bytes, but cannot claim content
verification. File access is an explicit adapter capability, not an implicit action by the pure
portable API.

Bundle `1.1.0` duplicates the embedded base64 bytes for each bound judgment. The artifact transport
alone costs `N × 4⌈B/3⌉` bytes for `N` judgments and a `B`-byte artifact, before JSON and judgment
metadata. A measured 1 MiB artifact bound by 100 synthetic judgments produced approximately
140 MB of serialized JSON. Large artifacts with large fanout therefore have material transport
and memory costs. This is a declared transport limitation, not a change to the native binding;
any future deduplication should be confined to a separately versioned transport contract.

## History and remaining human responsibility

Accepted judgments acquire bindings through authorized successors, not content edits. Existing
self-supersession, cycles, competing succession and reciprocal-history rules still apply. A
proposed judgment cannot claim to have superseded an accepted judgment. An artifact shared by two
judgments does not combine their targets or transfer acceptance.

An artifact and binding changed together may be content-consistent while contradicting the human
decision. Content association cannot detect that semantic or authorization defect. The human/Git
review boundary remains responsible for choosing the artifact, comparing its disposition with the
judgment, and authorizing changes. Existing unrelated verifier/projector disagreements are outside
this experiment.
