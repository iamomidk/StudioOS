from __future__ import annotations

import math
from statistics import fmean, pvariance

from .models import PricingJob, PricingRecommendation

CATEGORY_FACTORS: dict[str, float] = {
    "camera": 1.00,
    "lens": 1.08,
    "lighting": 0.95,
    "audio": 0.93,
    "grip": 0.90,
    "drone": 1.12,
    "other": 1.00,
}

SEASONALITY_FACTORS: dict[str, float] = {
    "low": 0.90,
    "normal": 1.00,
    "high": 1.12,
    "peak": 1.22,
}


class PricingEngineError(Exception):
    pass


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def recommend_price(job: PricingJob) -> PricingRecommendation:
    if job.base_daily_rate_cents <= 0:
        raise PricingEngineError("baseDailyRateCents must be greater than zero")

    category_factor = CATEGORY_FACTORS.get(job.category.lower(), CATEGORY_FACTORS["other"])
    seasonality_factor = SEASONALITY_FACTORS.get(
        job.seasonality.lower(), SEASONALITY_FACTORS["normal"]
    )

    history = [
        _clamp(value, 0.0, 1.0)
        for value in job.utilization_history
        if not math.isnan(value) and not math.isinf(value)
    ]
    utilization = fmean(history) if history else 0.5

    utilization_factor = 0.85 + (utilization * 0.40)
    raw_rate = job.base_daily_rate_cents * utilization_factor * category_factor * seasonality_factor
    suggested_rate = int(round(raw_rate))

    sample_factor = _clamp(len(history) / 12.0, 0.1, 1.0)
    variance_penalty = _clamp(pvariance(history) if len(history) > 1 else 0.0, 0.0, 0.25)
    confidence = round(
        _clamp((0.55 + (sample_factor * 0.35) - (variance_penalty * 0.6)), 0.15, 0.95), 2
    )

    explanation = (
        f"Baseline {job.base_daily_rate_cents}c adjusted by utilization ({utilization_factor:.2f}x), "
        f"category ({category_factor:.2f}x), and seasonality ({seasonality_factor:.2f}x)."
    )

    return PricingRecommendation(
        suggested_daily_rate_cents=suggested_rate,
        confidence=confidence,
        explanation=explanation,
    )
