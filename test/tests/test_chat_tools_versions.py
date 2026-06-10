"""Chat, sessions, models, tools, MCP, versions, measurement."""
from __future__ import annotations

import uuid

from config import FAKE_MODEL_ID, FAKE_PLAN_ID, FAKE_SESSION_ID


class TestChatSessions:
    def test_chat_get_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/chat")
        assert resp.status_code == 200

    def test_chat_clear_positive(self, admin_client, novel_project):
        resp = admin_client.delete(f"/projects/{novel_project['id']}/chat")
        assert resp.status_code == 200

    def test_sessions_create_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/sessions",
            json_body={"title": "会话测试"},
        )
        assert resp.status_code == 200
        assert resp.json().get("id") or resp.json().get("session_id")

    def test_sessions_get_positive(self, admin_client, session_id):
        pid, sid = session_id
        resp = admin_client.get(f"/projects/{pid}/sessions/{sid}")
        assert resp.status_code == 200

    def test_sessions_get_negative_not_found(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/sessions/{FAKE_SESSION_ID}")
        assert resp.status_code == 404

    def test_sessions_patch_positive(self, admin_client, session_id):
        pid, sid = session_id
        resp = admin_client.patch(
            f"/projects/{pid}/sessions/{sid}",
            json_body={"title": "重命名"},
        )
        assert resp.status_code == 200


class TestModels:
    def test_models_list_positive(self, admin_client):
        resp = admin_client.get("/models")
        assert resp.status_code == 200

    def test_models_create_positive(self, admin_client):
        resp = admin_client.post(
            "/models",
            json_body={
                "name": f"pytest-model-{uuid.uuid4().hex[:6]}",
                "provider": "openai",
                "model": "gpt-4o-mini",
                "base_url": "https://api.openai.com/v1",
                "api_key": "sk-test-pytest-key",
            },
        )
        assert resp.status_code in (200, 201)
        if resp.status_code in (200, 201):
            mid = resp.json().get("id")
            if mid:
                admin_client.delete(f"/models/{mid}")

    def test_models_delete_negative_not_found(self, admin_client):
        resp = admin_client.delete(f"/models/{FAKE_MODEL_ID}")
        assert resp.status_code == 404

    def test_settings_get_positive(self, admin_client):
        resp = admin_client.get("/settings")
        assert resp.status_code == 200


class TestToolsMcp:
    def test_tools_overview_positive(self, admin_client):
        resp = admin_client.get("/tools/overview")
        assert resp.status_code == 200

    def test_tools_skills_positive(self, admin_client):
        resp = admin_client.get("/tools/skills")
        assert resp.status_code == 200

    def test_tools_default_skill_positive(self, admin_client):
        resp = admin_client.get("/tools/default-skill")
        assert resp.status_code == 200

    def test_mcp_overview_positive(self, admin_client):
        resp = admin_client.get("/mcp/overview")
        assert resp.status_code == 200

    def test_mcp_servers_positive(self, admin_client):
        resp = admin_client.get("/mcp/servers")
        assert resp.status_code == 200

    def test_mcp_studio_get_positive(self, admin_client):
        resp = admin_client.get("/mcp/studio")
        assert resp.status_code == 200

    def test_mcp_call_negative_missing_fields(self, admin_client):
        resp = admin_client.post("/mcp/call", json_body={})
        assert resp.status_code == 400

    def test_skill_preflight_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/skill/preflight")
        assert resp.status_code == 200


class TestVersionsMeasurement:
    def test_versions_list_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/versions")
        assert resp.status_code == 200

    def test_versions_create_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/versions/create",
            json_body={"label": "pytest-version"},
        )
        assert resp.status_code == 200

    def test_measurement_review_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/measurement/review")
        assert resp.status_code == 200

    def test_measurement_health_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/measurement/health")
        assert resp.status_code == 200

    def test_measurement_review_run_positive(self, admin_client, novel_project):
        resp = admin_client.post(f"/projects/{novel_project['id']}/measurement/review/run")
        assert resp.status_code == 200

    def test_studio_overview_positive(self, admin_client):
        resp = admin_client.get("/studio/overview")
        assert resp.status_code == 200

    def test_studio_dashboard_positive(self, admin_client):
        resp = admin_client.get("/studio/dashboard")
        assert resp.status_code == 200
