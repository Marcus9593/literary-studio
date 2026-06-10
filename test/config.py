"""Test configuration for Literary Studio API tests."""
import os

BASE_URL = os.environ.get("STUDIO_BASE_URL", "http://127.0.0.1:8765").rstrip("/")
API_PREFIX = "/api"
WS_URL = os.environ.get("STUDIO_WS_URL", BASE_URL.replace("http://", "ws://").replace("https://", "wss://") + "/ws")

ADMIN_USERNAME = os.environ.get("STUDIO_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("STUDIO_ADMIN_PASSWORD", "admin123")

REQUEST_TIMEOUT = float(os.environ.get("STUDIO_TEST_TIMEOUT", "30"))

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
