# Review artifact binding

Writ can bind a human review judgment to the exact bytes of a file in the repository.

A binding stores two things:

- the repository-relative file path; and
- a SHA-256 hash of the complete file bytes.

This lets Writ detect when the file is missing, moved, or changed. The file must be tracked by Git and
must stay inside the repository.

A valid binding proves only that the judgment points to those exact bytes. It does not prove who
wrote the file, whether the review was correct, or whether the underlying claim is true.

This feature belongs to Writ's existing source and review tooling. A future decision object may use
it when exact provenance is useful, but it is not required for every decision problem.

The full September 2026 technical audit is preserved under
`docs/history/reference/review-artifact-binding-2026-09.md`.
