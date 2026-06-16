"""场景测试：导入导出流程"""
import pytest
from conftest import unique_title


class TestImportExport:
    """导入导出：创建项目 → 写内容 → 导出各格式"""

    def test_export_formats(self, admin_client):
        """SC-EXP-01: 导出格式检查"""
        resp = admin_client.get("/export/formats")
        assert resp.status_code == 200

        resp = admin_client.get("/upload/formats")
        assert resp.status_code == 200

    def test_project_export(self, admin_client):
        """SC-EXP-02: 项目导出"""
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("export"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        admin_client.post(f"/projects/{pid}/manuscripts", json_body={
            "title": "第一章", "content": "# 第一章\n\n测试内容。"
        })

        resp = admin_client.get(f"/projects/{pid}/download", query={"format": "zip"})
        assert resp.status_code == 200

        admin_client.delete(f"/projects/{pid}")
