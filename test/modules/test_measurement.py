"""审稿和测量测试 - 覆盖 /measurement 端点"""
import pytest


class TestMeasurement:
    """审稿测量"""

    def test_get_review(self, admin_client, novel_project):
        """TC-MSR-01: 获取最新审查"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/measurement/review")
        assert resp.status_code == 200

    def test_get_health_view(self, admin_client, novel_project):
        """TC-MSR-02: 获取健康视图"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/measurement/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "overall_health" in data


class TestExport:
    """导出功能"""

    def test_get_export_formats(self, admin_client):
        """TC-EXP-01: 获取导出格式"""
        resp = admin_client.get("/export/formats")
        assert resp.status_code == 200

    def test_get_upload_formats(self, admin_client):
        """TC-EXP-02: 获取上传格式"""
        resp = admin_client.get("/upload/formats")
        assert resp.status_code == 200


class TestSessions:
    """会话管理"""

    def test_list_sessions(self, admin_client, novel_project):
        """TC-SES-01: 列出会话"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/sessions")
        assert resp.status_code == 200

    def test_create_session(self, admin_client, novel_project):
        """TC-SES-02: 创建会话"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/sessions", json_body={"title": "测试会话"})
        assert resp.status_code == 200
        assert resp.json().get("id") or resp.json().get("session_id")

    def test_get_session(self, admin_client, novel_project, session_id):
        """TC-SES-03: 获取会话详情"""
        pid, sid = session_id
        resp = admin_client.get(f"/projects/{pid}/sessions/{sid}")
        assert resp.status_code == 200

    def test_get_session_memory(self, admin_client, novel_project, session_id):
        """TC-SES-04: 获取会话记忆"""
        pid, sid = session_id
        resp = admin_client.get(f"/projects/{pid}/sessions/{sid}/memory")
        assert resp.status_code == 200
