# Reference decision case

`packages/decision-case/` is the current small reference implementation for mathematical decision
work in Writ.

It demonstrates four useful properties:

1. exact mathematical inputs are preserved as bytes;
2. a local producer returns a candidate result;
3. a separate checker tests the candidate against the intended problem; and
4. mathematical checking, real-world applicability, and human choice remain separate records.

The current profile supports one finite linear uncertainty model through a pinned Python/SciPy
engine. Its role is to preserve the exact-binding and independent-checking lessons while the broader
decision object is tested across additional mathematical systems.

The runnable synthetic example is under `examples/decision-cases/failure-choice/`.

Future engine adapters can reuse these checking patterns while keeping richer mathematics in the
external tools that already implement it well.
