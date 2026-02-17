from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class MediaJob:
    job_id: str
    organization_id: str
    asset_id: str
    source_url: str
    callback_path: str

    @staticmethod
    def from_payload(payload: dict[str, Any]) -> "MediaJob":
        return MediaJob(
            job_id=str(payload.get("jobId", "")),
            organization_id=str(payload.get("organizationId", "")),
            asset_id=str(payload.get("assetId", "")),
            source_url=str(payload.get("sourceUrl", "")),
            callback_path=str(payload.get("callbackPath", "/workers/media/status")),
        )


@dataclass(frozen=True)
class MediaProcessingResult:
    metadata: dict[str, Any]
    thumbnail_url: str
    proxy_url: str | None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
