import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    media_worker_port: int
    api_base_url: str
    redis_url: str
    media_jobs_queue: str
    callback_token: str
    ffmpeg_binary_path: str


def load_settings() -> Settings:
    return Settings(
        media_worker_port=int(os.getenv("MEDIA_WORKER_PORT", "8101")),
        api_base_url=os.getenv("API_BASE_URL", "http://localhost:3000"),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        media_jobs_queue=os.getenv("MEDIA_JOBS_QUEUE", "media-jobs"),
        callback_token=os.getenv("MEDIA_WORKER_CALLBACK_TOKEN", ""),
        ffmpeg_binary_path=os.getenv("FFMPEG_BINARY_PATH", "ffmpeg"),
    )
