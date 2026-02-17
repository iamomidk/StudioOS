# media_worker_python

FastAPI-based media worker service with:

- `/health` endpoint
- queue-consumer iteration for `media-jobs`
- deterministic metadata extraction + thumbnail/proxy generation stubs
- API callback lifecycle updates (`processing`, `completed`, `failed`)

## Runtime notes

- `app/main.py` exposes `run_consumer_iteration(...)` for worker loop integration.
- `RedisQueueClient` is available when `redis` package is installed; tests use in-memory queue client.
- Proxy generation is currently a deterministic stub with an FFmpeg path seam (`FFMPEG_BINARY_PATH`).
