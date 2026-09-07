.PHONY: bootstrap check test

bootstrap:
	bun install
	python3 -m venv .venv
	. .venv/bin/activate && pip install -e "apps/ingest[dev]"

check:
	bun run format
	bun run lint
	bun run typecheck
	bun run test
	. .venv/bin/activate && ruff check apps/ingest internal/tooling/scripts internal/verification && pytest apps/ingest internal/verification

test: check
