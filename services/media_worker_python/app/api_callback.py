from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib import request


@dataclass(frozen=True)
class CallbackClient:
    base_url: str
    callback_token: str = ""

    def post_status(self, callback_path: str, payload: dict[str, Any]) -> None:
        url = f"{self.base_url.rstrip('/')}{callback_path}"
        data = json.dumps(payload).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.callback_token:
            headers["X-Worker-Token"] = self.callback_token

        req = request.Request(url, data=data, headers=headers, method="POST")
        with request.urlopen(req, timeout=5):  # noqa: S310
            return
