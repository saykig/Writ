---
name: writ-release-history
description: Maintain Writ's release, recovery, snapshot, and historical records as a separate maintenance role.
---

# Release history

Use this skill for release notes, version tags, recovery points, snapshots, or historical
reconstruction.

This role owns historical maintenance. Decision objects, mathematical engines, adapters, and runtime
semantics stay in their respective current-work roles.

## Before changing history

Read `docs/history/releases/README.md`, `docs/history/releases/manifest.json`, and the relevant
historical files. Verify the exact commit, tree, tags, and existing release metadata from repository
evidence.

## Rules

- Preserve Git history and published version-tag targets.
- Describe older states from the evidence available at those states.
- Keep numbered releases, named recovery points, and `snapshot/*` artifacts distinct.
- Record identities and claims supported by repository evidence.
- Record publication time and historical target-commit time as separate facts.
- Treat release publication as an explicitly authorized human action.

## Done when

The historical record identifies the exact state being described, what existed at that state, what
was known then, and the recovery path for that state.
