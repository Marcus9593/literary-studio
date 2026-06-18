#!/usr/bin/env python3
"""Configure DeepSeek model for integration tests (reads key from STUDIO_DEEPSEEK_KEY)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from helpers.client import ApiClient


def main() -> int:
    api_key = os.environ.get("STUDIO_DEEPSEEK_KEY", "").strip()
    if not api_key:
        print("STUDIO_DEEPSEEK_KEY 未设置", file=sys.stderr)
        return 1

    c = ApiClient()
    c.login("admin", "admin123")
    payload = c.get("/models").json()
    items = payload.get("models") or []
    if not isinstance(items, list):
        items = []

    body = {
        "name": "DeepSeek",
        "model": "deepseek-chat",
        "base_url": "https://api.deepseek.com/anthropic",
        "api_key": api_key,
        "protocol": "anthropic",
    }

    mid = None
    for m in items:
        blob = f"{m.get('name', '')}{m.get('model', '')}{m.get('base_url', '')}".lower()
        if "deepseek" in blob:
            mid = m["id"]
            break

    if mid:
        r = c.put(f"/models/{mid}", json_body=body)
        action = "update"
    else:
        r = c.post("/models", json_body=body)
        action = "create"
    if r.status_code not in (200, 201):
        print(f"{action} failed: {r.status_code} {r.text[:300]}", file=sys.stderr)
        return 1
    mid = mid or r.json().get("id")
    print(f"model {action} ok id={mid}")

    tr = c.post("/models/test", json_body={**body, "model_id": mid})
    if tr.status_code != 200:
        print(f"connection test failed: {tr.status_code} {tr.text[:300]}", file=sys.stderr)
        return 1
    test_data = tr.json()
    print(f"connection test ok verified={test_data.get('ok', test_data.get('success'))}")

    ar = c.post(f"/models/{mid}/activate")
    if ar.status_code != 200:
        print(f"activate failed: {ar.status_code} {ar.text[:300]}", file=sys.stderr)
        return 1
    print("model activated")

    health = c.get("/health").json()
    inf = health.get("inference") or {}
    print(f"health inference mode={inf.get('mode')} model={inf.get('model')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
