import unittest
from collections import deque

from app.api_callback import CallbackClient
from app.main import process_single_pricing_job, run_consumer_iteration
from app.models import PricingJob
from app.pricing_engine import PricingEngineError, recommend_price
from app.queue_consumer import InMemoryQueueClient
from app.settings import Settings


class _RecordingCallbackClient(CallbackClient):
    def __init__(self) -> None:
        super().__init__(base_url="http://localhost:3000")
        self.payloads: list[dict[str, object]] = []

    def post_status(self, callback_path: str, payload: dict[str, object]) -> None:
        _ = callback_path
        self.payloads.append(payload)


class PricingWorkerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = Settings(
            pricing_worker_port=8102,
            api_base_url="http://localhost:3000",
            redis_url="redis://localhost:6379",
            pricing_jobs_queue="pricing-jobs",
            callback_token="",
        )

    def test_recommend_price_is_deterministic_for_sample(self) -> None:
        payload = {
            "jobId": "price-1",
            "organizationId": "org-1",
            "category": "camera",
            "seasonality": "high",
            "baseDailyRateCents": 10000,
            "utilizationHistory": [0.3, 0.5, 0.7, 0.8],
            "callbackPath": "/workers/pricing/status",
        }

        recommendation = recommend_price(PricingJob.from_payload(payload))

        self.assertEqual(recommendation.suggested_daily_rate_cents, 12096)
        self.assertEqual(recommendation.confidence, 0.64)
        self.assertIn("utilization", recommendation.explanation)

    def test_process_single_pricing_job_reports_processing_then_completed(self) -> None:
        callback = _RecordingCallbackClient()
        payload = {
            "jobId": "price-2",
            "organizationId": "org-1",
            "category": "lens",
            "seasonality": "normal",
            "baseDailyRateCents": 12000,
            "utilizationHistory": [0.4, 0.45, 0.55],
            "callbackPath": "/workers/pricing/status",
        }

        result = process_single_pricing_job(payload, callback)

        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(callback.payloads), 2)
        self.assertEqual(callback.payloads[0]["status"], "processing")
        self.assertEqual(callback.payloads[1]["status"], "completed")

    def test_process_single_pricing_job_reports_failed_status(self) -> None:
        callback = _RecordingCallbackClient()
        payload = {
            "jobId": "price-3",
            "organizationId": "org-1",
            "category": "camera",
            "seasonality": "peak",
            "baseDailyRateCents": 0,
            "utilizationHistory": [0.5, 0.6],
            "callbackPath": "/workers/pricing/status",
        }

        with self.assertRaises(PricingEngineError):
            process_single_pricing_job(payload, callback)

        self.assertEqual(len(callback.payloads), 2)
        self.assertEqual(callback.payloads[0]["status"], "processing")
        self.assertEqual(callback.payloads[1]["status"], "failed")

    def test_run_consumer_iteration_processes_next_queue_job(self) -> None:
        queue = InMemoryQueueClient(
            queue=deque(
                [
                    {
                        "jobId": "price-4",
                        "organizationId": "org-1",
                        "category": "audio",
                        "seasonality": "low",
                        "baseDailyRateCents": 8000,
                        "utilizationHistory": [0.2, 0.3, 0.4],
                        "callbackPath": "/workers/pricing/status",
                    }
                ]
            )
        )
        callback = _RecordingCallbackClient()

        result = run_consumer_iteration(queue, self.settings, callback)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(callback.payloads), 2)


if __name__ == "__main__":
    unittest.main()
