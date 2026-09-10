# Reopen, challenge, and return one empirical result

This example packages Bellman's completed AFY 2024 predictor comparison so another tool can find the
evidence, rerun the existing checks, challenge a proposed new use, and return a linked assessment.
It does not copy the human-participant data or turn the result into a Writ decision case.

The research result is deliberately modest. Under the primary specification, the fixed-versus-
updated predictor comparison is inconclusive. A simpler Markov/report predictor scores better in
both target treatments, and supplied utility and prior choices can change the candidate comparison.
The decision question here is whether those results warrant relying on the strategic predictor in a
new setting—not which institutional mechanism to choose.

## Run the export and independent reopen

The export and reimport boundaries need Python 3.9 or later. The fully locked consumer run targets
macOS arm64 CPython 3.13 and fails closed on another platform rather than building an sdist. You
also need Bellman commit `58987d2389b6fc841a2b780cb45d4369d6a3e436`, network access for the pinned
consumer wheels, and a separately acquired author data file matching SHA-256
`fbb9136eaaa6b56e66201f57379bd3891f72d80a91cf34c43d76213287abf8a3`.

```sh
python3 examples/empirical-handoffs/afy-2024-ro-crate/run_roundtrip.py \
  --bellman-dir /path/to/bellman/research/beliefs_2024 \
  --raw-data /external/Aoyagi_2024a_data.txt \
  --consumer-python /path/to/python3.13 \
  --output /tmp/afy-2024-handoff
```

The command:

1. verifies every frozen Bellman input/output named by its first-run manifest;
2. copies the permitted Bellman artifacts, never the raw author data, into a disposable crate;
3. runs Bellman's producer-disabled numerical receiver and changed-use transfer controls;
4. creates an RO-Crate 1.1 / Process Run Crate 0.5 envelope;
5. installs exact PyPI wheels in a disposable environment with dependency resolution and source
   builds disabled; and
6. reopens every entity with `rocrate==0.15.1`, verifying attached hashes and process links.

It then stops with `recipient_response_required`. Give a fresh recipient only:

- `/tmp/afy-2024-handoff/crate/`;
- `crate/handoff/recipient-task.json`; and
- `crate/handoff/RECIPIENT_RESPONSE.md`.

No expected successor assessment is included. After the recipient writes its JSON response, run:

```sh
python3 examples/empirical-handoffs/afy-2024-ro-crate/reimport.py \
  --crate /tmp/afy-2024-handoff/crate \
  --response /path/to/independent-recipient-response.json \
  --payload-manifest-sha256 <issued-payload-manifest-sha256-from-export-result> \
  --metadata-sha256 <issued-metadata-sha256-from-export-result> \
  --output /tmp/afy-2024-handoff/reimported-assessment.json
```

The reimporter requires the payload-manifest identity emitted at issuance, enumerates all crate
files, rejects undeclared bytes and any renamed copy of the raw-data bytes, checks all declared
bytes again, preserves the original by identity, requires the complete intended-use change,
resolves every cited JSON pointer, and rejects invented authority. It records the recipient
interpretation as supplied—not as verified truth.

## Recover the exact executed issuance

The final coherent crate seen by the independent recipient is retained without the raw data as a
standard tar.gz archive. Its SHA-256 is
`e0dc6f7e04d63b6b37dbc1aef2fd5c278853a3ac95db27770f3acb63e5dd0522`.

```sh
issued_dir=$(mktemp -d /tmp/afy-issued-crate.XXXXXX)
tar -xzf \
  examples/empirical-handoffs/afy-2024-ro-crate/evidence/issued-crate-752b2b33.tar.gz \
  -C "$issued_dir"
python3 examples/empirical-handoffs/afy-2024-ro-crate/reimport.py \
  --crate "$issued_dir/crate" \
  --response examples/empirical-handoffs/afy-2024-ro-crate/evidence/independent-recipient-response.json \
  --payload-manifest-sha256 752b2b3378cb11eff2379cc28b4c3d7974df99a67769189481b0b4b1f34e79a3 \
  --metadata-sha256 52eec0a24a4e5ea055af6d7d8099cd568c46aa231f5bcabfb277847aad37a40f
```

The retained validator, standard-consumer, environment, recipient-response, and reimport receipts
in `evidence/` are exact bytes from this issuance. The separate orchestrator-authored provenance
receipt records the zero-history controls and leaves unavailable model/runtime/timestamp facts
unrecorded. `ROUNDTRIP_EVIDENCE.json` records the archive creation/extraction methods and hashes.

## Focused controls

These tests use temporary boundary-control responses, not a retained recipient conclusion:

```sh
python3 examples/empirical-handoffs/afy-2024-ro-crate/test_boundary.py \
  --bellman-dir /path/to/bellman/research/beliefs_2024 \
  --raw-data /external/Aoyagi_2024a_data.txt
```

The ten-test suite includes positive export/receiving and successor-link controls. Its negative
cases reject altered pinned extras or licence bytes, altered or relabelled evidence, stale or
incomplete intended use, a wrong challenged dependency, rewriting the predecessor, invented
authority, undeclared files, nested renamed raw-data bytes, declared symlinks, and payload-manifest
or metadata bytes that do not match the issued identities.

## What each check means

| Check              | Earned result                                                              | Not established                                              |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| RO-Crate consumer  | Standard metadata can locate the payload, external source and process runs | Empirical truth                                              |
| Profile validator  | All 42 required profile checks pass                                        | Four recommended checks: relative script IDs and identities  |
| SHA-256 receiving  | The attached and externally supplied bytes match                           | Correctness or meaning of those bytes                        |
| Bellman receiver   | Exact residual bounds and retained predictions/scores reconstruct          | Global fit, bootstrap coverage, causal identification        |
| Transfer check     | Changed operation/timing cannot silently reuse the old result              | Whether a new setting is empirically suitable                |
| Recipient response | A challenge and disposition are preserved as a successor                   | Human review, institutional authority, real-world usefulness |

The executed evidence retains the independently authored response and its reimport receipt. The
separate profile validator passed all 42 required checks; 94 of 98 checks passed when recommended
requirements were included. The remaining recommendations concern relative IDs for the two
attached, hash-bound execution scripts and absent agents, author, and publisher identities, which
this example does not invent.

The validator reports are hash-bound historical results, not a dependency-closed validator
reproduction claim: `validator-environment.json` retains every installed version, but only the
`roc-validator` and `pyshacl` wheel artifacts were hash-pinned. The issued Actions also do not encode
their interpreter identity. `bellman-runtime-receipt.json` separately records a named CPython
3.13.15 rerun whose canonical JSON outputs matched both issued Bellman receipts byte-for-byte; it
does not retroactively change the Action metadata.

See [the reuse decision](REUSE_DECISION.md) for semantic fit and loss,
[the dependency inventory](DEPENDENCY_LICENSES.json) for exact installed metadata, and
[the execution evidence](ROUNDTRIP_EVIDENCE.json) for commands, real failures, hashes, validator
results, and the retained successor.
