# Internal infrastructure

- `config/` contains reviewed operational registry and vocabulary inputs.
- `generated/` contains deterministic compatibility projections required by consumers and drift
  checks.
- `database/` contains SQL migrations used by the API and CI.

These paths support operation and verification; they do not compete with `corpora/`, `schemas/`, or
`protocols/` as authorities.
