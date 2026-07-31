# Codex execution prompts

Run these in order unless an ADR explicitly changes dependencies. Each prompt expects Codex to read `AGENTS.md`, the relevant specifications, `TASKS.yaml`, and existing tests before editing.

At the end of every task, Codex should report:

- files changed;
- commands run and their results;
- acceptance criteria met;
- unresolved risks or specification conflicts;
- the next task that is unblocked.

Do not merge generated code that bypasses schema validation, weakens unknown handling, or makes a score depend on model output.
