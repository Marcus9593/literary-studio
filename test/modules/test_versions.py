"""版本管理测试 - 覆盖所有 /versions 端点"""
import pytest


class TestVersionCRUD:
    """版本增删改查"""

    def test_create_version(self, admin_client, novel_project):
        """TC-VER-01: 创建版本快照"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/versions/create", json_body={
            "title": "测试快照", "notes": "回归测试"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("id")

    def test_list_versions(self, admin_client, novel_project, version_id):
        """TC-VER-02: 列出版本"""
        pid, _ = version_id
        resp = admin_client.get(f"/projects/{pid}/versions")
        assert resp.status_code == 200
        data = resp.json()
        versions = data if isinstance(data, list) else data.get("versions", [])
        assert len(versions) > 0

    def test_get_version_detail(self, admin_client, novel_project, version_id):
        """TC-VER-03: 获取版本详情"""
        pid, vid = version_id
        resp = admin_client.get(f"/projects/{pid}/versions/{vid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("title") or data.get("id")

    def test_get_version_diff(self, admin_client, novel_project, version_id):
        """TC-VER-04: 获取版本 Diff"""
        pid, vid = version_id
        resp = admin_client.get(f"/projects/{pid}/versions/{vid}/diff")
        assert resp.status_code == 200

    def test_restore_version(self, admin_client, novel_project, version_id):
        """TC-VER-05: 恢复版本"""
        pid, vid = version_id
        resp = admin_client.post(f"/projects/{pid}/versions/{vid}/restore")
        assert resp.status_code == 200

    def test_delete_version(self, admin_client, novel_project):
        """TC-VER-06: 删除版本"""
        pid = novel_project["id"]
        # 创建
        resp = admin_client.post(f"/projects/{pid}/versions/create", json_body={"title": "待删除"})
        vid = resp.json()["id"]

        # 删除
        resp = admin_client.delete(f"/projects/{pid}/versions/{vid}")
        assert resp.status_code == 200
