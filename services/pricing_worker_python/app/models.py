from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class PricingJob:
    job_id: str
    organization_id: str
    category: str
    seasonality: str
    base_daily_rate_cents: int
    utilization_history: list[float]
    callback_path: str

    @staticmethod
    def from_payload(payload: dict[str, Any]) -> "PricingJob":
        raw_history = payload.get("utilizationHistory", [])
        history = [float(value) for value in raw_history] if isinstance(raw_history, list) else []

        return PricingJob(
            job_id=str(payload.get("jobId", "")),
            organization_id=str(payload.get("organizationId", "")),
            category=str(payload.get("category", "other")),
            seasonality=str(payload.get("seasonality", "normal")),
            base_daily_rate_cents=int(payload.get("baseDailyRateCents", 0)),
            utilization_history=history,
            callback_path=str(payload.get("callbackPath", "/workers/pricing/status")),
        )


@dataclass(frozen=True)
class PricingRecommendation:
    suggested_daily_rate_cents: int
    confidence: float
    explanation: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
