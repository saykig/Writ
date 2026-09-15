# Review artifact binding

Writ can bind a human review judgment to the exact bytes of a file in the repository.

A binding stores:

- the repository-relative file path; and
- a SHA-256 hash of the complete file bytes.

This gives the review judgment a precise byte-level target and makes later file changes visible.

A valid binding certifies byte identity. Authorship, review quality, and claim truth remain separate
questions with their own evidence.

This feature belongs to Writ's existing source and review tooling. A decision object can use it when
exact provenance is useful.

The full September 2026 technical audit is preserved under
`docs/history/reference/review-artifact-binding-2026-09.md`.
