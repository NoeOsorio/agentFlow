"""Entry point for ``python -m agentflow_runtime`` (Docker Compose, local runs)."""

from __future__ import annotations

import os
import time

from .healthcheck import health
from .logging_config import get_logger, setup_logging


def main() -> None:
    setup_logging()
    log = get_logger(component="main")
    interval = int(os.getenv("AGENTFLOW_RUNTIME_HEALTH_INTERVAL", "30"))
    log.info(
        "runtime_process_start",
        note=(
            "Stand-in process until Celery worker wiring lands (plan A2); "
            "periodic Redis health checks."
        ),
        interval_seconds=interval,
    )
    while True:
        result = health()
        if result["status"] != "healthy":
            log.warning(
                "runtime_health_unhealthy",
                status=result["status"],
                checks=result["checks"],
            )
        else:
            log.info("runtime_health_ok", checks=result["checks"])
        time.sleep(interval)


if __name__ == "__main__":
    main()
