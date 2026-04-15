"""Structured logging configuration for AgentFlow Runtime."""

import os

import structlog


def setup_logging() -> None:
    """Configure structlog for the runtime service."""
    env = os.getenv("AGENTFLOW_ENV", "development")
    is_production = env == "production"

    # stdlib add_logger_name requires logging.Logger; PrintLogger has no .name
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if is_production:
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(0),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(**kwargs: object) -> structlog.stdlib.BoundLogger:
    """Get a logger with standard runtime context fields."""
    return structlog.get_logger(
        service="agentflow-runtime",
        env=os.getenv("AGENTFLOW_ENV", "development"),
        version=os.getenv("AGENTFLOW_VERSION", "0.0.1"),
        **kwargs,
    )


def get_execution_logger(
    run_id: str,
    pipeline_name: str,
    company_name: str | None = None,
    agent_name: str | None = None,
) -> structlog.stdlib.BoundLogger:
    """Get a logger pre-bound with execution context fields.

    Use this during pipeline/agent execution to automatically include
    run_id, pipeline_name, company_name, and agent_name in all log entries.
    """
    return get_logger(
        run_id=run_id,
        pipeline_name=pipeline_name,
        company_name=company_name,
        agent_name=agent_name,
    )
