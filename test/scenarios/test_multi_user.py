"""场景测试：多用户协作"""
import uuid

import pytest
from conftest import unique_title


class TestMultiUser:
    """多用户：创建用户 → 分享项目 → 协作"""

    def test_project_sharing(self, admin_client):
        """SC-MUL-01: 项目分享流程"""
        # 1. 创建项目
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("share"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        # 2. 获取分享信息
        resp = admin_client.get(f"/projects/{pid}/shares")
        assert resp.status_code == 200

        # 3. 创建测试用户
        username = f"test_share_{uuid.uuid4().hex[:8]}"
        resp = admin_client.post("/auth/users", json_body={
            "username": username, "display_name": "测试协作者", "password": "test123456"
        })
        assert resp.status_code == 201
        uid = resp.json().get("id")

        # 4. 更新分享设置
        if uid:
            resp = admin_client.put(f"/projects/{pid}/shares", json_body={
                "shares": [{"user_id": uid, "role": "read"}]
            })
            assert resp.status_code == 200

            # 清理用户
            admin_client.delete(f"/auth/users/{uid}")

        admin_client.delete(f"/projects/{pid}")


class TestUserPermissions:
    """用户权限"""

    def test_admin_operations(self, admin_client):
        """SC-MUL-02: 管理员操作"""
        # 列出用户
        resp = admin_client.get("/auth/users")
        assert resp.status_code == 200

        # 获取当前用户
        resp = admin_client.get("/auth/me")
        assert resp.status_code == 200
        user = resp.json().get("user", resp.json())
        assert user.get("role") in ("admin", "super_admin")
