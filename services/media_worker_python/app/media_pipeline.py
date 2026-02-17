from __future__ import annotations

from typing import Any

from .models import MediaJob, MediaProcessingResult


class MediaPipelineError(Exception):
    pass


def extract_metadata(source_url: str) -> dict[str, Any]:
    if not source_url.startswith(("http://", "https://", "s3://")):
        raise MediaPipelineError("Unsupported source URL")

    return {
        "sourceUrl": source_url,
        "codec": "h264",
        "durationSeconds": 120,
        "width": 1920,
        "height": 1080,
    }


def generate_thumbnail(source_url: str, asset_id: str) -> str:
    # Placeholder path for future object-store upload integration.
    return f"{source_url.rstrip('/')}/thumbnails/{asset_id}.jpg"


def generate_proxy(source_url: str, asset_id: str, ffmpeg_binary_path: str) -> str:
    # Stub path that preserves deterministic behavior in tests while exposing
    # a future FFmpeg integration seam.
    _ = ffmpeg_binary_path
    return f"{source_url.rstrip('/')}/proxy/{asset_id}.mp4"


def process_media_job(job: MediaJob, ffmpeg_binary_path: str) -> MediaProcessingResult:
    metadata = extract_metadata(job.source_url)
    thumbnail_url = generate_thumbnail(job.source_url, job.asset_id)
    proxy_url = generate_proxy(job.source_url, job.asset_id, ffmpeg_binary_path)

    return MediaProcessingResult(
        metadata=metadata,
        thumbnail_url=thumbnail_url,
        proxy_url=proxy_url,
    )
