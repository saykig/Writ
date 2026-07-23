# Build the Covenant language toolchain

## Instruction

Use Langium to implement the language target in `03_LANGUAGE_SPEC.md` and `specs/covenant.ebnf`. Add literate Markdown extraction, parser recovery, imports pinned to content hashes, symbol linking, type checking, source maps, formatting, AST-to-IR lowering, and an LSP usable in Monaco and VS Code.

Acceptance: all `.covenant` examples parse and compile to schema-valid IR; formatter is idempotent; diagnostics point to exact source spans; no embedded general-purpose code is permitted.

## Non-goals

Do not redesign settled ADRs without opening a replacement ADR. Do not add broad infrastructure that is not required by the acceptance criteria. Do not hide incomplete behavior behind mocks in production paths.
