from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass
from typing import Any, Protocol


class QueueClientPort(Protocol):
    def pop_job(self, queue_name: str) -> dict[str, Any] | None: ...


@dataclass
class InMemoryQueueClient(QueueClientPort):
    queue: deque[dict[str, Any]]

    def pop_job(self, queue_name: str) -> dict[str, Any] | None:
        _ = queue_name
        if not self.queue:
            return None
        return self.queue.popleft()


class RedisQueueClient(QueueClientPort):
    def __init__(self, redis_url: str):
        try:
            import redis  # type: ignore[import-not-found]
        except ImportError as error:  # pragma: no cover
            raise RuntimeError("redis package is required for RedisQueueClient") from error

        self._redis = redis.from_url(redis_url)

    def pop_job(self, queue_name: str) -> dict[str, Any] | None:
        raw = self._redis.lpop(queue_name)
        if raw is None:
            return None

        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")

        payload = json.loads(raw)
        if isinstance(payload, dict):
            return payload
        return None
