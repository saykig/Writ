---
name: writ-engine-adapter
description: Evaluate and connect Writ to established mathematical software through a narrow local adapter.
---

# Engine adapter

Use this skill when choosing, testing, or implementing a mathematical engine for a defined Writ
decision problem.

## Role

Start from the exact mathematical operation, not a preferred library or language.

For each serious donor tool, record:

1. project and exact version;
2. license and local installation burden;
3. native mathematical objects and guarantees;
4. the Writ fields the adapter uses;
5. units and numeric representation;
6. translation losses and unsupported states;
7. exact request and result boundaries; and
8. what Writ can check independently.

Run a real local example before making the dependency part of Writ.

## Adapter rule

Keep the adapter thin. Writ may validate, translate, invoke, receive, bind, and check. It must not
silently strengthen the donor engine's result or claim two formalisms are equivalent because their
field names look similar.

Use the donor ecosystem in its natural language when that is the cleanest boundary. Python, Julia,
R, C++, Rust, Lean, or another language may sit behind the adapter.

Separate candidate production from checking when a useful independent check exists. When it does
not, state exactly what remains trusted.

## Done when

There is one reproducible local example, exact version and license information, a documented
translation, decisive unsupported cases, and a clear statement of what the returned result does and
does not establish.

If the question becomes whether Writ adds value beyond calling the engine directly, hand the task to
`writ-proving-ground`.
