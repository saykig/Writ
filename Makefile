.PHONY: bootstrap check test db-up db-down

bootstrap:
	bun install
	python3 -m venv .venv
	. .venv/bin/activate && pip install -e "apps/ingest[dev]"

check:
	bun run format
	bun run lint
	bun run typecheck
	bun run test
	. .venv/bin/activate && ruff check apps/ingest && pytest apps/ingest

test: check

db-up:
	docker compose up -d postgres minio

db-down:
	docker compose down
