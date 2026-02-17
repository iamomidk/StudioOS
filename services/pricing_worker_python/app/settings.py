import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    pricing_worker_port: int
    api_base_url: str
    redis_url: str
    pricing_jobs_queue: str
    callback_token: str


def load_settings() -> Settings:
    return Settings(
        pricing_worker_port=int(os.getenv("PRICING_WORKER_PORT", "8102")),
        api_base_url=os.getenv("API_BASE_URL", "http://localhost:3000"),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        pricing_jobs_queue=os.getenv("PRICING_JOBS_QUEUE", "pricing-jobs"),
        callback_token=os.getenv("PRICING_WORKER_CALLBACK_TOKEN", ""),
    )
