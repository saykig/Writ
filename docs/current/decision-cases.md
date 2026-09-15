# Reference decision case

`packages/decision-case/` is the current small reference implementation for mathematical decision
work in Writ.

It demonstrates four useful properties:

1. exact mathematical inputs are preserved as bytes rather than silently rewritten;
2. a local producer can return a candidate result;
3. a separate checker can test the candidate against the intended problem; and
4. mathematical checking stays separate from real-world applicability and human choice.

The current profile supports one finite linear uncertainty model through a pinned Python/SciPy
engine. It is deliberately narrow. It does not define the future Writ decision-object schema and
should not be generalized into a solver registry.

The runnable synthetic example is under `examples/decision-cases/failure-choice/`.

Future work should reuse the exact-binding and independent-checking lessons from this package while
letting established external tools own richer mathematics.
