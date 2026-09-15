---
name: writ-release-history
description: Maintain Writ's release, recovery, snapshot, and historical records without changing current architecture.
---

# Release history

Use this skill for release notes, version tags, recovery points, snapshots, or historical
reconstruction.

This role does not design decision objects, choose mathematical engines, or change runtime
semantics. Split those changes into a separate task.

## Before changing history

Read `docs/history/releases/README.md`, `docs/history/releases/manifest.json`, and the relevant
historical files. Verify the exact commit, tree, tags, and existing release metadata rather than
relying on current retrospective prose.

## Rules

- Do not rewrite Git history or move a published version tag.
- Do not make the current architecture appear inevitable when describing an older state.
- Keep numbered releases, named recovery points, and `snapshot/*` artifacts distinct.
- Record only identities and claims that repository evidence can support.
- Treat publication time and the historical target commit time as different facts.
- Release publication requires explicit human authorization.

## Done when

The historical record identifies the exact state being described, what existed at that state, what
was known then, and how it can be recovered without changing current runtime behavior.
