# Portable provenance-kernel falsification report

This is the implementation audit for `KERNEL-PORTABLE-PROVENANCE-001`. The result is a small
mechanical package boundary, not a generalization of Writ. Native research objects stay sovereign.
Callers supply source/document-version authority; Writ separately decides whether that authority is
routed for a corpus.

## Frozen Writ baseline and rebase proof

PR #36 was rebased onto `main` at `646c82ede1b6ffd94f592e23d754f2f8e3e307fa`, whose history
contains the accepted PR #35 provenance commit
`615a4a7ba6be3e8cb3d8e6618eb64835c4346b5e`. PR #36 now targets `main`; it does not retain the
deleted PR #35 branch as its base.

The final PR #35 regression oracle
`internal/verification/writ/test/native-provenance.test.ts` was byte-identical on the rebased branch
and frozen `main` (`sha256:b8ebe659644d2b589483c0f7fc01967b8e6c3e621802996334a74de0fcb33b29`). Running that exact file
on the rebased branch passed all 26 tests and 125 expectations. This is the differential proof for
the accepted/rejected outcomes and diagnostic classes covering:

- same-file duplicate native sources;
- reviewed canonical, alias, and legacy-reference source collisions;
- identical and conflicting reviewed passage duplicates;
- routed and unrouted duplicates;
- normalized routes and safe internal-symlink routes;
- compatibility passage routing through its owning corpus;
- link-owner laundering and native-record corpus mismatch;
- superseded and withdrawn link evidence auditing;
- current-native/compatibility scoping and current-native passage conflicts.

No new issue found in this sprint is an `UPSTREAM_PR35_DEFECT`. The portability changes leave the
frozen test oracle unchanged and keep every repository rule in the Writ adapter.

## Adversarial matrix

| Attack | Result | Falsification proof | Boundary decision |
| --- | --- | --- | --- |
| 1. Rebase parity | `CONFIRMED` | Exact frozen-main test bytes; 26/26 tests and 125 expectations pass after rebase. | PR #35 behavior remains authoritative Writ behavior. |
| 2. Signature construction order | `DEFECT_FIXED` | Multiple six-field insertion permutations now produce one key; NFC/NFD quote bytes still differ. | `passageSignatureKey` reconstructs one fixed field order without Canonical JSON. |
| 3. Canonical runtime domain | `DEFECT_FIXED` | Date, Map, Set, RegExp, boxed values, class/custom-prototype objects, cyclic objects/arrays, and depth 513 throw `CanonicalJsonError`; depth 512 and all historical goldens pass. | Only plain in-memory JSON is supported; no hash migration. |
| 4. NFC × `dropFields` | `DEFECT_FIXED` | `/café` drops both composed and decomposed spellings, including nested normalized paths; an undropped NFC collision still fails. | Omission pointers address the NFC-normalized key space. |
| 5. Malformed caller authority | `DEFECT_FIXED` | Missing/empty/non-string fields, malformed/uppercase hashes, and a malformed item beside a valid duplicate return `invalid_authority` / `PROVENANCE_AUTHORITY_INVALID`; valid extensions pass. | Any malformed declaration invalidates the complete supplied authority; institutional legitimacy remains caller policy. |
| 6. Integrity versus namespace | `DEFECT_FIXED` | Two unrelated scopes use `passage-17` with different valid signatures: per-reference verification passes; only an explicitly combined occurrence scope conflicts. | `verifyEvidenceReferences` is per-reference; `logicalPassageConflicts` is explicitly caller-scoped. |
| 7. Exact UTF-8 / malformed Unicode | `DEFECT_FIXED` | Lone high/low surrogates throw `IllFormedUnicodeError`; U+FFFD, a valid pair, NFC/NFD, LF/CRLF, NBSP, tabs, outer whitespace, BOM, and zero-width text have pinned distinct valid hashes. | Exact valid text remains byte-sensitive; malformed JS strings cannot collapse through replacement encoding. |
| 8. Occurrence determinism | `DEFECT_FIXED` | Reversing valid occurrences preserves output; duplicate `(passageId, occurrenceId)` with different opaque context throws the same typed `LogicalPassageOccurrenceError`. | Occurrence identity is a caller contract; the kernel never inspects opaque context. |
| 9. Cross-primitive identity | `CONFIRMED_WITH_NARROW_CONTRACT` | Canonical NFC/NFD objects may hash equally while source IDs, version IDs, locators, and quotes remain distinct in resolution/signatures. | Canonical hashes are not identifier-equivalence oracles; external identifier sovereignty is preserved. |
| 10. `dropFields` profile | `CONFIRMED_WITH_NARROW_CONTRACT` | `{id, decision}` hashed with `/decision` omitted equals `{id}` while its unprofiled hash differs. | `dropFields` is a specified Writ identity-profile transform, not generic object equality. |
| 11. Real Aldera oracle | `CONFIRMED_WITH_LIMITS` | Frozen fixture pins actual extracted PDF-page and HTML-section references, document hashes, normalized quotes, passage hashes, source resolution, verification, and conflict outcomes from Aldera commit `9b7d05e…`. | Read-only golden data; no runtime import or Aldera modification. |
| 12. Evidence naming | `DEFECT_FIXED` | Public declarations and packed TypeScript consumer use `AnchoredTextEvidenceReference`. | The package claims quoted/anchored text only and adds no speculative evidence types. |
| 13. Decision-provenance layering | `CONFIRMED` | Imports and boundary tests keep repository/domain modules out of the package; documentation makes every semantic non-implication explicit. | Mechanical integrity does not accept evidence, facts, relationships, transitions, or decisions. |

## Real Aldera oracle

`packages/provenance/test/fixtures/aldera-ucdp-holdout.json` freezes two actual references produced
by the reviewed Aldera code and local artifacts at commit
`9b7d05e9fb2ed11c315e9b6a1dca66e3a8aa9eb4`:

- PDF page 1 of `ucdp-brd-codebook-261.pdf`, source `ucdp.brd_codebook`, version
  `ucdp.brd_codebook.v26_1`, document hash
  `sha256:b0f9162cee38358dc108c7ecf4218c7b6c121e64d456b04a9fcbf1f8414b9b75`, and
  passage hash `sha256:c38b4bbc074149e1346453cf59ce0e5a0c9deb2e3d5f06ed84c6ffc4d9e4cd88`;
- the materially different HTML download-section locator from
  `ucdp-downloads-2026-08-31.html`, source `ucdp.downloads`, version
  `ucdp.downloads.v2026_08_31`, document hash
  `sha256:1e83d7e0ad98fb73151381f7fd77a4ac3f4473e66a81b472beeffd307046c53b`, and
  passage hash `sha256:7421fc991fd3989ff12335901dd714063f1663865b0cea3755cc22348c8c3a3e`.

Both artifact hashes independently agree with Aldera's tracked source registry. The frozen fixture
contains the real Aldera-normalized extracted text and expected resolved/no-diagnostic/no-conflict
outcomes. It imports no Aldera code or artifact at runtime. This oracle does **not** prove Aldera
lineage-graph equivalence, receipts, traversal, coverage, or replacement of Aldera dependencies.

## Boundary audit

| Classification | Concrete code | Reason |
| --- | --- | --- |
| `PORTABLE_GENERIC` | `packages/provenance/src/canonical-json.ts`: `canonicalJson`, `CanonicalJsonError` | Writ Canonical JSON v1 has a bounded plain-JSON runtime domain and pinned historical vectors. |
| `PORTABLE_GENERIC` | `packages/provenance/src/hash.ts`: canonical and exact-text hashing | The operations are pure and deterministic; exact text rejects ill-formed Unicode. |
| `PORTABLE_GENERIC` | `packages/provenance/src/evidence.ts`: anchored-text and caller-authority integrity | The minimal contract answers only mechanical source/version/document/passage-hash questions. |
| `PORTABLE_GENERIC` | `packages/provenance/src/evidence.ts`: explicit logical-passage scope | Conflict detection operates only on caller-supplied occurrences and opaque context. |
| `WRIT_REPOSITORY_ADAPTER` | `internal/verification/writ/src/core/sources.ts` | Physical lookup, manifest routes, aliases, compatibility identity mappings, and authorization are Writ policy. |
| `WRIT_REPOSITORY_ADAPTER` | `internal/verification/writ/src/core/passages.ts` | Writ defines native/compatibility scope, expands aliases, and supplies unique occurrence IDs and repository context. |
| `WRIT_REPOSITORY_ADAPTER` | `internal/verification/writ/src/gates/provenance.ts` | The gate chooses Writ contracts, projects routed authority, and maps portable diagnostics into Writ context. |
| `WRIT_DOMAIN_SPECIFIC` | `packages/domain/src/records.ts` and provenance gate semantics | Assertions, evidence basis, families, links, judgments, review, supersession, and inherited support remain Writ contracts. |
| `NOT_PROVEN_GENERIC` | Compatibility dialects, source licensing/routing, and source-registry operational policy | The consumers need these policies, but independent evidence does not establish them as kernel primitives. |
| `NOT_PROVEN_GENERIC` | Aldera lineage manifests, graph, receipts, traversal, and coverage | These are coherent consumer-side lineage capabilities, not mechanical provenance primitives. |

## Preserved decision-provenance layering

The architecture remains:

`source/version mechanical integrity` → `anchored evidence integrity` → `Writ evidence grounding` →
`typed institutional/policy fact` → `human review` → `relationship` → `defensible transition` →
`eventual decision-provenance chain`

The portable package owns only the first two mechanics. A valid source hash does not mean the
passage supports a claim; a valid passage hash does not mean the claim is true; neither means an
inference is justified, a relationship is accepted, or a decision was warranted.

The packed artifact contains only its README, package manifest, built ESM, source maps, and type
declarations. Its external-consumer test installs the tarball into a temporary directory, verifies
that the installed package is not a workspace symlink, compiles a TypeScript consumer, executes a
Node.js consumer, rejects internal subpaths, and scans the artifact for workspace imports and
absolute local paths.
