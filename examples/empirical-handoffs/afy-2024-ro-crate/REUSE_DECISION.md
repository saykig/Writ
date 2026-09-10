# Reuse decision: AFY 2024 research handoff

**Decision date:** 10 September 2026

**Status:** retain as a bounded example-level adapter

**Needed claim:** a third-party consumer can reopen an exact, non-raw AFY research handoff and a
later recipient assessment can be linked without rewriting the original or silently extending its
use.

## Selected reuse

- [RO-Crate Metadata Specification 1.1](https://w3id.org/ro/crate/1.1) is the base exchange
  specification.
- [Process Run Crate 0.5](https://w3id.org/ro/wfrun/process/0.5) is the profile. Version 0.5
  explicitly extends RO-Crate 1.1 and fits this implicit sequence of command-line tools; there is no
  workflow engine to justify Workflow Run or Provenance Run Crate.
- [ro-crate-py 0.15.1](https://pypi.org/project/rocrate/0.15.1/) is the standard consumer. The exact
  universal wheel is pinned by SHA-256
  `fc04c1078774259ad8c70779c40acec14d80a8cf310db1e8f51ae65720c153fa`. Its licence is
  Apache-2.0. Every exercised dependency is an exact PyPI wheel URL in
  `requirements-consumer.lock`; source builds and dependency resolution are disabled. This closed
  lock targets the actually exercised macOS arm64 CPython 3.13 environment rather than claiming
  portability it has not tested. `DEPENDENCY_LICENSES.json` records each installed distribution's
  exact declared licence field, expression, or classifier and preserves the Jinja2 and
  python-dateutil metadata ambiguities instead of resolving them by guesswork.
- Bellman's existing standard-library receiver and transfer gate remain the numerical and
  intended-use checks. RO-Crate does not replace them.

Process Run Crate 0.6 now exists, but it extends RO-Crate 1.3. This trial retains the permanent 0.5
and 1.1 pair because that is the exact pairing inspected and exercised with the pinned consumer. A
future upgrade should be a new compatibility check, not a metadata relabelling.

## Translation and semantic loss

RO-Crate earns discovery and ordinary tool interoperability: files, external data reference,
software, executions, inputs, and outputs can be found without knowing Writ paths. It does not
encode or prove Bellman's exact residual semantics, bootstrap coverage, empirical assumptions,
applicability, recipient interpretation, disposition, or authority. Those remain native bytes and
separate receipts.

The author data is referenced by its public author URL, byte count, and SHA-256. It is never copied
into the crate because the displayed archive CC BY 4.0 licence has not been tied to the author-hosted
bytes. Bellman's attached code and research artifacts remain exact copies of Apache-2.0 Bellman
commit `58987d2389b6fc841a2b780cb45d4369d6a3e436`, with that licence included. The crate root states
that Apache-2.0 covers its metadata and attached Bellman/Writ materials only; the separate external
Web data entity has no inherited licence claim and says its redistribution licence is unestablished.

## Executed validation

`roc-validator==0.11.3`, with `pyshacl==0.31.0`, passed all 42 required Process Run Crate 0.5 and
RO-Crate 1.1 checks. A recommended-level run passed 94 of 98 checks. It recommended absolute IDs
for the two attached, hash-bound script instruments and reported missing Action agents and root
author/publisher identities; none were invented to satisfy recommendations. An earlier required run
failed because the external Web data entity was only mentioned. Making it reachable through root
`hasPart`, while leaving it unattached, corrected that real failure.

The exact validator reports are retained, along with a complete installed-version receipt. That
validator environment is not dependency-closed because transitive artifact hashes were not
captured; only the `roc-validator` and `pyshacl` wheels have retained artifact identities. This
narrows the result to the historical report bound to the exact crate metadata.

The issued Process Run Actions do not encode the ambient interpreter identity. A separate
post-issuance runtime receipt reruns the issued attached scripts under a named, hash-recorded CPython
3.13.15 interpreter and confirms that canonical JSON matches both issued outputs byte-for-byte. The
receipt is additional verification, not retroactive Action metadata.

The exact validator wheel identities, commands, results, independent-recipient leakage controls,
issued manifest identity, and layer-separated outcomes are in `ROUNDTRIP_EVIDENCE.json`.

## Maintenance cost and retention decision

The adapter is a small exporter/orchestrator/reimport boundary plus a pinned consumer environment.
Retain it at the example boundary because the final zero-history recipient completed the following
gate:

1. a real `ro-crate-py` process reopens every attached entity;
2. attached hashes and the deliberately absent raw data survive transfer;
3. Bellman's existing receiver and transfer controls still pass;
4. an independently authored successor names the changed use, cites attached evidence, preserves
   the original, and cannot claim unchanged applicability or authority; and
5. metadata-based discovery and process links let a fresh recipient navigate the handoff without
   knowing Bellman or Writ source paths.

This trial does not justify a Writ statistical schema, estimator, solver registry, ontology, fork,
or replacement of Bellman's current arithmetic receiver. Reassess or retire it if the pinned
profile/consumer pair can no longer reopen the crate, the Bellman byte pins change, or recipients do
not need this exchange boundary.

See `DEPENDENCY_LICENSES.json` for the exact runtime licence inventory and
`ROUNDTRIP_EVIDENCE.json` for the executed validation and retained assessment link.
