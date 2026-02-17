import unittest
from collections import deque

from app.api_callback import CallbackClient
from app.main import process_single_media_job, run_consumer_iteration
from app.media_pipeline import MediaPipelineError
from app.queue_consumer import InMemoryQueueClient
from app.settings import Settings


class _RecordingCallbackClient(CallbackClient):
    def __init__(self) -> None:
        super().__init__(base_url="http://localhost:3000")
        self.payloads: list[dict[str, object]] = []

    def post_status(self, callback_path: str, payload: dict[str, object]) -> None:
        _ = callback_path
        self.payloads.append(payload)


class MediaWorkerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = Settings(
            media_worker_port=8101,
            api_base_url="http://localhost:3000",
            redis_url="redis://localhost:6379",
            media_jobs_queue="media-jobs",
            callback_token="",
            ffmpeg_binary_path="ffmpeg",
        )

    def test_process_single_media_job_reports_processing_then_completed(self) -> None:
        callback = _RecordingCallbackClient()
        payload = {
            "jobId": "job-1",
            "organizationId": "org-1",
            "assetId": "asset-1",
            "sourceUrl": "https://cdn.example.com/media/video.mp4",
            "callbackPath": "/workers/media/status",
        }

        result = process_single_media_job(payload, self.settings, callback)

        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(callback.payloads), 2)
        self.assertEqual(callback.payloads[0]["status"], "processing")
        self.assertEqual(callback.payloads[1]["status"], "completed")

    def test_process_single_media_job_reports_failed_status(self) -> None:
        callback = _RecordingCallbackClient()
        payload = {
            "jobId": "job-2",
            "organizationId": "org-1",
            "assetId": "asset-2",
            "sourceUrl": "file:///tmp/video.mp4",
            "callbackPath": "/workers/media/status",
        }

        with self.assertRaises(MediaPipelineError):
            process_single_media_job(payload, self.settings, callback)

        self.assertEqual(len(callback.payloads), 2)
        self.assertEqual(callback.payloads[0]["status"], "processing")
        self.assertEqual(callback.payloads[1]["status"], "failed")

    def test_run_consumer_iteration_processes_next_queue_job(self) -> None:
        queue = InMemoryQueueClient(
            queue=deque(
                [
                    {
                        "jobId": "job-3",
                        "organizationId": "org-1",
                        "assetId": "asset-3",
                        "sourceUrl": "https://cdn.example.com/media/clip.mov",
                        "callbackPath": "/workers/media/status",
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
