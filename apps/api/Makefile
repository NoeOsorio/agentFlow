.PHONY: migrate migrate-new migrate-down migrate-status

migrate:
	uv run alembic upgrade head

migrate-new:
	uv run alembic revision --autogenerate -m "$(name)"

migrate-down:
	uv run alembic downgrade -1

migrate-status:
	uv run alembic current
