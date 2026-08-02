"""Helpers for fire-and-forget asyncio background tasks."""
import asyncio
import logging

logger = logging.getLogger(__name__)


def create_logged_task(coro, label: str) -> "asyncio.Task":
    """Like asyncio.create_task, but logs any exception the task raises.

    Fire-and-forget tasks silently swallow exceptions unless something
    retrieves the task's result - this guarantees failures are always visible.
    """
    task = asyncio.create_task(coro)

    def _log_if_failed(t: "asyncio.Task") -> None:
        if t.cancelled():
            return
        exc = t.exception()
        if exc is not None:
            logger.error(f"Background task '{label}' failed: {exc}", exc_info=exc)

    task.add_done_callback(_log_if_failed)
    return task
