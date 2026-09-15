---
name: writ-decision-integration
description: Connect a bounded Writ decision problem to established mathematical software without weakening its semantics.
---

# Decision integration

Use this skill when evaluating or implementing a mathematical engine adapter.

## Start with the operation

State the exact mathematical operation Writ needs before choosing a library. Then identify a mature
engine whose native semantics fit that operation.

For each candidate engine record:

1. project and exact version;
2. license and installation burden;
3. native mathematical objects used;
4. Writ fields required;
5. translation losses or unsupported states;
6. exact request and result format; and
7. what can be checked independently.

Run one local example before adding a durable dependency.

## Adapter boundary

Keep adapters thin. Writ may validate, translate, invoke, receive, bind, and check. It must not
silently strengthen the donor engine's result.

A probability model, influence diagram, optimization model, POMDP, simulation, or proof object keeps
its own meaning. Similar field names do not make different formalisms interchangeable.

## Candidate versus check

When possible, separate result production from checking. Bind the check to the exact intended
problem, units, assumptions, action set, objective, and information structure required by the claim.

If an independent check is not practical, say what remains trusted rather than describing producer
success as independent assurance.

## Language choice

Use the language that makes the mathematical boundary clearest. TypeScript is suitable for Writ's
application and interchange layer. Python, Julia, R, C++, Rust, Lean, or another language may own a
specific engine or checker.

Test Rust when several supported result types need a small portable exact checker. Use Lean when a
stable formal theorem or checker property becomes a repeated dependency. Do not migrate for style.
