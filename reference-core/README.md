# Covenant reference core

This is a dependency-light executable specification for the highest-risk semantics:

- four-valued truth;
- comparison over exact values and count intervals;
- deterministic score-branch selection;
- bounded detection of score gaps, overlaps, and unreachable branches, including competing normalizations of ambiguous source language.

It is not the production evaluator. The production packages should pass the same conformance cases and may use Z3 for larger symbolic domains. Run:

```bash
npm test
```
