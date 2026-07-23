# Implement signed releases and monitoring

## Instruction

Build release manifests, canonical hashes, signatures, receipt verification, change comparison, and scheduled source monitoring. Add release gates for schemas, conformance, methodology diagnostics, review completeness, source coverage, discrepancies, and reproducibility.

Acceptance: a release can be rebuilt from its manifest; tampering changes verification status; score changes show their exact evidence or methodology cause; monitoring creates candidates, never automatic published-score changes.

## Non-goals

Do not redesign settled ADRs without opening a replacement ADR. Do not add broad infrastructure that is not required by the acceptance criteria. Do not hide incomplete behavior behind mocks in production paths.
