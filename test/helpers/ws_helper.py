"""WebSocket helper for Literary Studio tests."""
from __future__ import annotations

import json
import time
from typing import Any, Optional

from config import WS_URL


class WsTestClient:
    def __init__(self, url: str = WS_URL):
        self.url = url
        self.ws = None

    def connect(self):
        try:
            import websocket  # type: ignore
        except ImportError as exc:
            raise RuntimeError("需要安装 websocket-client: pip install websocket-client") from exc
        self.ws = websocket.create_connection(self.url, timeout=10)
        return self

    def close(self):
        if self.ws:
            self.ws.close()
            self.ws = None

    def send_json(self, payload: dict[str, Any]):
        assert self.ws is not None
        self.ws.send(json.dumps(payload))

    def recv_json(self, timeout: float = 5.0) -> dict[str, Any]:
        assert self.ws is not None
        self.ws.settimeout(timeout)
        raw = self.ws.recv()
        return json.loads(raw)

    def auth(self, token: str) -> dict[str, Any]:
        self.send_json({"type": "auth", "token": token})
        return self.recv_json()

    def wait_for_type(self, msg_type: str, timeout: float = 5.0, max_messages: int = 10) -> Optional[dict[str, Any]]:
        deadline = time.time() + timeout
        for _ in range(max_messages):
            remaining = deadline - time.time()
            if remaining <= 0:
                break
            msg = self.recv_json(timeout=remaining)
            if msg.get("type") == msg_type:
                return msg
        return None
