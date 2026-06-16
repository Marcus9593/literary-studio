"""Test configuration for Literary Studio API tests."""
from __future__ import annotations

import json
import os
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
_TARGETS_DIR = _ROOT / "targets"


def _load_target(name: str) -> dict:
    path = _TARGETS_DIR / f"{name}.json"
    if not path.is_file():
        return {}
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _target_default_base(target: dict) -> str:
    if target.get("base_url"):
        return str(target["base_url"]).rstrip("/")
    host = str(target.get("host", "127.0.0.1"))
    port = target.get("port")
    if port:
        return f"http://{host}:{port}"
    return "http://127.0.0.1:8765"


_TARGET_NAME = os.environ.get("STUDIO_TARGET", "local")
_TARGET = _load_target(_TARGET_NAME)
_DEFAULT_BASE = _target_default_base(_TARGET)

BASE_URL = os.environ.get("STUDIO_BASE_URL", _DEFAULT_BASE).rstrip("/")
API_PREFIX = "/api"

_default_ws = _TARGET.get("ws_url")
if os.environ.get("STUDIO_BASE_URL") or not _default_ws:
    _default_ws = BASE_URL.replace("http://", "ws://").replace("https://", "wss://") + "/ws"
WS_URL = os.environ.get("STUDIO_WS_URL", str(_default_ws))

ADMIN_USERNAME = os.environ.get("STUDIO_ADMIN_USER", _TARGET.get("admin_user", "admin"))
ADMIN_PASSWORD = os.environ.get("STUDIO_ADMIN_PASSWORD", _TARGET.get("admin_password", "admin123"))

REQUEST_TIMEOUT = float(os.environ.get("STUDIO_TEST_TIMEOUT", _TARGET.get("timeout", 30)))

FAKE_PROJECT_ID = "00000000-000-fake-project-id"
FAKE_USER_ID = "00000000-000-fake-user-id"
FAKE_CHAPTER = "nonexistent-chapter.md"
FAKE_SESSION_ID = "fake-session-id"
FAKE_PLAN_ID = "fake-plan-id"
FAKE_VERSION_ID = "fake-version-id"
FAKE_RULE_ID = "99999"
FAKE_SCENE_ID = "sc_fake0001"
FAKE_EPISODE_ID = "ep_fake0001"
FAKE_FORESHADOW_ID = "fs_fake0001"
FAKE_SHOT_ID = "sh_fake0001"
FAKE_TASK_ID = "task_fake0001"
FAKE_ACTION_ID = "action_fake0001"
FAKE_RUN_ID = "run_fake0001"
FAKE_CHARACTER_ID = "char_fake0001"
FAKE_SECTION_ID = "sec_fake0001"
FAKE_JOB_ID = "job_fake0001"
FAKE_MODEL_ID = "model_fake0001"
FAKE_SERVER_ID = "server_fake0001"
FAKE_POST_ID = "post_fake0001"
FAKE_REPLY_ID = "reply_fake0001"
FAKE_SKILL_ID = "skill_fake0001"
FAKE_SNAPSHOT_ID = "snap_fake0001"
FAKE_ASSET_ID = "asset_fake0001"
