---
name: writ-engine-adapter
description: Evaluate and connect Writ to established mathematical software through a narrow local adapter.
---

# Engine adapter

Use this skill when choosing, testing, or implementing a mathematical engine for a defined Writ
decision problem.

## Role

Start from the exact mathematical operation and choose the library or language that fits it best.

For each serious donor tool, record:

1. project and exact version;
2. license and local installation burden;
3. native mathematical objects and guarantees;
4. the Writ fields the adapter uses;
5. units and numeric representation;
6. translation losses and supported states;
7. exact request and result boundaries; and
8. the independent checks Writ can perform.

Run a real local example before making the dependency durable.

## Adapter rule

Keep the adapter thin. Writ validates, translates, invokes, receives, binds, and checks while
preserving the donor engine's native claim.

Use the donor ecosystem in its natural language when that gives the clearest boundary. Python,
Julia, R, C++, Rust, Lean, or another language can sit behind the adapter.

Separate candidate production from checking when a useful independent check exists. Record the
trusted portion of the engine boundary when direct checking ends.

## Done when

There is one reproducible local example, exact version and license information, a documented
translation, decisive unsupported cases, and a clear statement of the result's mathematical scope.

When the next question is whether Writ improves the workflow relative to using the engine directly,
hand the task to `writ-proving-ground`.
