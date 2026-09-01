# Portable provenance-kernel boundary

This is the implementation audit for `KERNEL-PORTABLE-PROVENANCE-001`. It tests the boundary
against the final Writ PR #35 head used by this stack (`dd386bc`) and the read-only Aldera lineage
implementation at commits `f00518f` and `9b7d05e`. The sprint initially began at PR #35 head
`ca18518`; when #35 advanced, the downstream commits were rebased onto `dd386bc`. The added
current-native/compatibility scoping, routed-citation authority, and gate-level indexing corrections
are `UPSTREAM_PR35_DEFECT` fixes already carried by that final baseline, not downstream workarounds.

The result is a small package boundary, not a generalization of Writ. Native research objects stay
sovereign. Callers supply source/document-version authority; Writ separately decides whether that
authority is routed for a corpus.

## Boundary audit

| Classification | Concrete code | Reason |
| --- | --- | --- |
| `PORTABLE_GENERIC` | `packages/provenance/src/canonical-json.ts`: `canonicalJson`, `CanonicalJsonError` | Existing deterministic Writ Canonical JSON v1 semantics have independent Aldera golden-vector evidence. |
| `PORTABLE_GENERIC` | `packages/provenance/src/hash.ts`: `sha256Canonical`, `sha256Utf8Text` | Canonical content identity and exact quote-byte identity are pure, deterministic, and domain-neutral. |
| `PORTABLE_GENERIC` | `packages/provenance/src/evidence.ts`: `EvidenceReference`, `SourceVersionDeclaration`, `resolveSourceVersion`, `verifyEvidenceReferences` | The minimal reference and caller-supplied authority reproduce the generic checks mirrored by Aldera without a corpus or Writ record. |
| `PORTABLE_GENERIC` | `packages/provenance/src/evidence.ts`: `evidencePassageSignature`, `passageSignatureKey`, `resolveLogicalPassage`, `logicalPassageConflicts` | Complete repeated-passage signatures and conflict detection operate only on supplied occurrences and opaque caller context. |
| `WRIT_REPOSITORY_ADAPTER` | `internal/verification/writ/src/core/sources.ts`: `matching`, `isRouted`, `resolveRoutedSource` | Physical-object lookup, manifest `locations.sources` authorization, source aliases, and compatibility identity mappings are Writ repository policy. |
| `WRIT_REPOSITORY_ADAPTER` | `internal/verification/writ/src/core/passages.ts`: `structuredPassageOccurrence`, `logicalPassageOccurrences`, `portableOccurrences` | These functions project compiled records and retained compatibility passages from `RepositorySnapshot`, expand Writ aliases, and attach corpus/file context before calling the kernel. |
| `WRIT_REPOSITORY_ADAPTER` | `internal/verification/writ/src/gates/provenance.ts`: current-native selection, source dialect extraction, routed-authority projection, diagnostic-context mapping | The gate decides which exact Writ contracts receive Core provenance checks and adapts routed Writ declarations to the portable shapes. |
| `WRIT_REPOSITORY_ADAPTER` | `internal/verification/writ/src/repository.ts` and `internal/verification/writ/src/types.ts`: `RepositorySnapshot`, loaders, indexed objects, source routes | Repository discovery and indexing are not portable provenance abstractions. |
| `WRIT_DOMAIN_SPECIFIC` | `packages/domain/src/records.ts`: `WritRecord`, `EvidenceBasis`, institutional and legal-policy profiles | The assertion envelope, family contracts, basis vocabulary, and typed records remain Writ domain contracts. |
| `WRIT_DOMAIN_SPECIFIC` | `internal/verification/writ/src/gates/provenance.ts`: nested institutional references, authority-source checks, inherited support traversal | Institutional evidence policy and inherited relationship support are not generic reference verification. |
| `WRIT_DOMAIN_SPECIFIC` | `internal/verification/writ/src/gates/provenance.ts`: record-link/judgment targets, supersession, review-state filtering, migration history | Links, judgments, review policy, and native identity migration remain Writ-specific. |
| `NOT_PROVEN_GENERIC` | Writ compatibility source identities, physical source aliases, passage aliases, and compatibility locator/source dialect extraction | Current Writ needs these adapters, but Aldera provides no independent evidence that their shapes belong in a portable contract. |
| `NOT_PROVEN_GENERIC` | `EvidenceBasis`, source licensing/routing policy, source-registry operational policy | Aldera can extend the minimal reference with basis and role, but neither field participates in generic integrity checks; authority selection belongs to the caller. |
| `NOT_PROVEN_GENERIC` | Aldera `src/lineage-graph.ts`, lineage manifests, catalog traversal, receipts, and coverage computation | These are coherent consumer-side lineage capabilities over grounded assertions, not provenance-kernel primitives. |

## Layering

`@writ/provenance` imports no Writ workspace package. The Writ verification harness first resolves
and authorizes a source through its catalogued manifest route, then projects only the resolved
source/version/hash declaration into the package. Institutional, legal-policy, link, judgment,
review, and migration checks continue after that adapter boundary.

The packed artifact contains only its README, package manifest, built ESM, source maps, and type
declarations. Its external-consumer test installs the tarball into a temporary directory, verifies
that the installed package is not a workspace symlink, compiles a TypeScript consumer, executes a
Node.js consumer, rejects access to internal subpaths, and scans the artifact for Writ workspace
imports and absolute local paths.
