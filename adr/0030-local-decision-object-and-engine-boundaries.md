# ADR 0030: Local decision object and engine boundaries

**Status:** Accepted

## Decision

Writ's active decision architecture centers on a local, domain-neutral decision object.

The object may represent variables, relationships or information structure, uncertainty, actions,
constraints, objectives, provenance bindings, exact engine requests, results, and independent checks.
The first public schema will be frozen only after bounded trials show which fields survive across
more than one mathematical family.

Writ will prefer established mathematical software over a Writ-built general solver. Each supported
engine gets a narrow adapter that preserves its native semantics, version, units, input/output
meaning, unsupported states, and translation losses.

The runtime path for an accepted proving case must work locally without an LLM or hosted service.
LLMs may later assist authoring or inspection but are not part of the correctness boundary.

TypeScript remains appropriate for current application and interchange code. Mathematical engines
may remain in Python, Julia, R, C++, or another language. Rust is considered for a small portable
checker when repeated checking needs justify it; Lean is considered when a stable formal theorem or
checker property becomes a repeated dependency.

`packages/decision-case/` remains a narrow reference for exact binding and independent checking. It
does not define the general object.

ADRs 0028 and 0029 remain historical records. They do not govern new decision work.

## Constraints

- Do not invent missing probabilities, utilities, causal assumptions, constraints, or authority.
- Do not flatten different mathematical relations into one generic graph relation.
- Do not create a universal solver registry or ontology before a proving case demonstrates the need.
- Keep mathematical checking, empirical adequacy, and human decision separate.
