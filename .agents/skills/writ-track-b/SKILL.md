---
name: writ-track-b
description: Run bounded, evidence-driven consistency reviews across Writ syntax, contracts, provenance, repository verification, export, and portable reload without expanding the product boundary.
---

# Writ Track B

Use this skill for explicit cross-layer correctness reviews of Writ's current
source -> passage -> typed record/link -> human judgment -> provenance -> portable representation
boundary.

## Method

1. Pin a clean exact baseline and read the governing product definition, relevant schemas, ADRs
   and active task.
2. State the supported layers that should agree and the documented responsibilities that may
   differ.
3. Prefer a few local synthetic counterexamples that reuse production entry points. Keep raw
   mutation output disposable.
4. Require independent confirmation before classifying or repairing a serious finding.
5. Classify genuine differences using the task's existing categories. Do not create new product
   concepts to explain a software inconsistency.
6. Add the decisive regression with the smallest existing-boundary repair. Stop at the task's
   repair limit and acceptance gate.

Treat a rejection as correct when it belongs to a documented layer responsibility. Record
unsuccessful hypotheses instead of forcing a finding.

## Roles

For a full Track B review, use all four provisional contracts independently:

- [Provenance consistency reviewer](references/provenance-consistency-reviewer.md)
- [Contract and schema reviewer](references/contract-schema-reviewer.md)
- [Export and interoperability reviewer](references/export-interoperability-reviewer.md)
- [Independent counterexample reviewer](references/independent-counterexample-reviewer.md)

For a narrower review, load only the references that own the affected boundary. Do not add a fifth
role. Evaluate overlap and retirement from observed results, not role activity or verbosity.

## Learning rule

Promote durable knowledge only after a concrete case demonstrates a reusable invariant, and only
when it is not captured better elsewhere. Prefer:

test > invariant > ADR/current doc > role reminder.

Keep case outcomes in `docs/current/agent-role-outcomes.md`, not in these role contracts.
