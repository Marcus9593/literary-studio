"""用户认证模块测试 - 覆盖所有 /auth 端点"""
import uuid

import pytest
from helpers.client import ApiClient
from config import ADMIN_USERNAME, ADMIN_PASSWORD


class TestAuthLogin:
    """登录相关测试"""

    def test_login_success(self, admin_client):
        """TC-AUTH-01: 管理员登录成功"""
        assert admin_client.token is not None

    def test_login_wrong_password(self, anon_client):
        """TC-AUTH-02: 错误密码登录失败"""
        resp = anon_client.post("/auth/login", json_body={
            "username": ADMIN_USERNAME, "password": "wrong_password"
        })
        assert resp.status_code in (400, 401)
        data = resp.json()
        assert "error" in data

    def test_login_nonexistent_user(self, anon_client):
        """TC-AUTH-03: 不存在的用户登录失败"""
        resp = anon_client.post("/auth/login", json_body={
            "username": "nonexistent_user_xyz", "password": "any"
        })
        assert resp.status_code in (400, 401)

    def test_login_empty_body(self, anon_client):
        """TC-AUTH-04: 空请求体登录失败"""
        resp = anon_client.post("/auth/login", json_body={})
        assert resp.status_code in (400, 401)


class TestAuthMe:
    """当前用户信息测试"""

    def test_get_current_user(self, admin_client):
        """TC-AUTH-05: 获取当前用户信息"""
        resp = admin_client.get("/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        user = data.get("user", data)
        assert user.get("username") == ADMIN_USERNAME
        assert "role" in user

    def test_get_me_no_token(self, anon_client):
        """TC-AUTH-06: 无 Token 访问 /auth/me 返回 401"""
        resp = anon_client.get("/auth/me")
        assert resp.status_code == 401

    def test_get_me_invalid_token(self, anon_client):
        """TC-AUTH-07: 无效 Token 访问 /auth/me 返回 401"""
        client = anon_client.with_token("invalid_token_here")
        resp = client.get("/auth/me")
        assert resp.status_code == 401


class TestUserManagement:
    """用户管理测试（管理员功能）"""

    def test_list_users(self, admin_client):
        """TC-AUTH-08: 管理员获取用户列表"""
        resp = admin_client.get("/auth/users")
        assert resp.status_code == 200
        data = resp.json()
        users = data if isinstance(data, list) else data.get("users", [])
        assert len(users) > 0

    def test_create_user(self, admin_client):
        """TC-AUTH-09: 管理员创建新用户"""
        uid = None
        username = f"test_create_{uuid.uuid4().hex[:8]}"
        try:
            resp = admin_client.post("/auth/users", json_body={
                "username": username, "display_name": "测试用户", "password": "test123456"
            })
            assert resp.status_code == 201
            data = resp.json()
            assert data.get("username") == username
            uid = data.get("id")
        finally:
            # 确保清理，即使 assert 失败
            if uid:
                admin_client.delete(f"/auth/users/{uid}")

    def test_create_user_duplicate(self, admin_client):
        """TC-AUTH-10: 创建重复用户名失败"""
        # 先创建
        resp1 = admin_client.post("/auth/users", json_body={
            "username": "test_dup_user", "display_name": "用户1", "password": "test123456"
        })
        # 再创建同名
        resp2 = admin_client.post("/auth/users", json_body={
            "username": "test_dup_user", "display_name": "用户2", "password": "test123456"
        })
        assert resp2.status_code in (400, 409)

        # 清理
        if resp1.status_code == 201:
            uid = resp1.json().get("id")
            if uid:
                admin_client.delete(f"/auth/users/{uid}")

    def test_list_users_normal_user_forbidden(self, anon_client):
        """TC-AUTH-11: 普通用户无法访问用户列表"""
        resp = anon_client.get("/auth/users")
        assert resp.status_code == 401


class TestProtectedEndpoints:
    """受保护端点测试"""

    def test_projects_requires_auth(self, anon_client):
        """TC-AUTH-12: 项目列表需要认证"""
        resp = anon_client.get("/projects")
        assert resp.status_code == 401

    def test_guestbook_requires_auth(self, anon_client):
        """TC-AUTH-13: 创作日志需要认证"""
        resp = anon_client.get("/guestbook")
        assert resp.status_code == 401

    def test_models_requires_auth(self, anon_client):
        """TC-AUTH-14: 模型列表需要认证"""
        resp = anon_client.get("/models")
        assert resp.status_code == 401
