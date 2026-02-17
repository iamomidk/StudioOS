from __future__ import annotations

from collections.abc import Callable
from typing import Any

try:
    from fastapi import FastAPI  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover

    class FastAPI:  # type: ignore[no-redef]
        def __init__(self, title: str, version: str):
            self.title = title
            self.version = version

        def get(self, _path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
                return func

            return decorator


from .api_callback import CallbackClient
from .media_pipeline import MediaPipelineError, process_media_job
from .models import MediaJob, utc_now_iso
from .queue_consumer import QueueClientPort, RedisQueueClient
from .settings import Settings, load_settings

app = FastAPI(title="StudioOS Media Worker", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def process_single_media_job(
    payload: dict[str, Any],
    settings: Settings,
    callback_client: CallbackClient,
) -> dict[str, Any]:
    job = MediaJob.from_payload(payload)

    if not job.job_id or not job.asset_id or not job.organization_id:
        raise ValueError("Invalid media job payload")

    callback_client.post_status(
        job.callback_path,
        {
            "jobId": job.job_id,
            "organizationId": job.organization_id,
            "assetId": job.asset_id,
            "status": "processing",
            "processedAt": utc_now_iso(),
        },
    )

    try:
        result = process_media_job(job, settings.ffmpeg_binary_path)
    except MediaPipelineError as error:
        callback_client.post_status(
            job.callback_path,
            {
                "jobId": job.job_id,
                "organizationId": job.organization_id,
                "assetId": job.asset_id,
                "status": "failed",
                "error": str(error),
                "processedAt": utc_now_iso(),
            },
        )
        raise

    completion_payload = {
        "jobId": job.job_id,
        "organizationId": job.organization_id,
        "assetId": job.asset_id,
        "status": "completed",
        "metadata": result.metadata,
        "thumbnailUrl": result.thumbnail_url,
        "proxyUrl": result.proxy_url,
        "processedAt": utc_now_iso(),
    }

    callback_client.post_status(job.callback_path, completion_payload)
    return completion_payload


def run_consumer_iteration(
    queue_client: QueueClientPort,
    settings: Settings,
    callback_client: CallbackClient,
) -> dict[str, Any] | None:
    payload = queue_client.pop_job(settings.media_jobs_queue)
    if payload is None:
        return None

    return process_single_media_job(payload, settings, callback_client)


def build_runtime() -> tuple[Settings, QueueClientPort, CallbackClient]:
    settings = load_settings()
    queue_client = RedisQueueClient(settings.redis_url)
    callback_client = CallbackClient(
        base_url=settings.api_base_url,
        callback_token=settings.callback_token,
    )
    return settings, queue_client, callback_client
