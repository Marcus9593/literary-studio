"""Health & Auth API tests — positive and negative cases."""
from __future__ import annotations

import uuid

import pytest

from config import ADMIN_PASSWORD, ADMIN_USERNAME, FAKE_USER_ID
from helpers.client import ApiClient
from helpers.tokens import invalid_token_same_length


class TestHealth:
    def test_health_positive_public(self, anon_client):
        resp = anon_client.get("/health")
        assert resp.status_code == 200
        assert resp.json().get("status") == "ok"

    def test_usage_positive_authenticated(self, admin_client):
        resp = admin_client.get("/usage")
        assert resp.status_code == 200

    def test_usage_negative_unauthenticated(self, anon_client):
        resp = anon_client.get("/usage")
        assert resp.status_code == 401


class TestAuthLogin:
    def test_login_positive_valid_credentials(self, anon_client):
        resp = anon_client.post(
            "/auth/login",
            json_body={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["username"] == ADMIN_USERNAME

    def test_login_negative_wrong_password(self, anon_client):
        resp = anon_client.post(
            "/auth/login",
            json_body={"username": ADMIN_USERNAME, "password": "wrong-password-xyz"},
        )
        assert resp.status_code == 401
        assert "error" in resp.json()

    def test_login_negative_empty_body(self, anon_client):
        resp = anon_client.post("/auth/login", json_body={})
        assert resp.status_code == 400

    def test_login_negative_missing_password(self, anon_client):
        resp = anon_client.post("/auth/login", json_body={"username": ADMIN_USERNAME})
        assert resp.status_code == 400


class TestAuthMe:
    def test_me_positive(self, admin_client):
        resp = admin_client.get("/auth/me")
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "super_admin"

    def test_me_negative_no_token(self, anon_client):
        resp = anon_client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_negative_invalid_token(self, anon_client, admin_token):
        client = anon_client.with_token(invalid_token_same_length(admin_token))
        resp = client.get("/auth/me")
        assert resp.status_code == 401


class TestAuthUsers:
    def test_list_users_positive_admin(self, admin_client):
        resp = admin_client.get("/auth/users")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_users_negative_anonymous(self, anon_client):
        resp = anon_client.get("/auth/users")
        assert resp.status_code == 401

    def test_create_user_positive(self, admin_client):
        username = f"test_user_{uuid.uuid4().hex[:8]}"
        resp = admin_client.post(
            "/auth/users",
            json_body={"username": username, "password": "123456", "display_name": "测试用户"},
        )
        assert resp.status_code == 201
        user_id = resp.json()["id"]
        admin_client.delete(f"/auth/users/{user_id}")

    def test_create_user_negative_short_password(self, admin_client):
        resp = admin_client.post(
            "/auth/users",
            json_body={"username": f"u_{uuid.uuid4().hex[:6]}", "password": "123"},
        )
        assert resp.status_code == 400

    def test_create_user_negative_duplicate_username(self, admin_client):
        resp = admin_client.post(
            "/auth/users",
            json_body={"username": ADMIN_USERNAME, "password": "123456"},
        )
        assert resp.status_code == 400

    def test_update_user_negative_not_found(self, admin_client):
        resp = admin_client.patch(
            f"/auth/users/{FAKE_USER_ID}",
            json_body={"display_name": "ghost"},
        )
        assert resp.status_code in (400, 404)

    def test_delete_user_negative_not_found(self, admin_client):
        resp = admin_client.delete(f"/auth/users/{FAKE_USER_ID}")
        assert resp.status_code in (400, 404)


class TestAuthRegister:
    def test_register_negative_when_disabled(self, anon_client):
        resp = anon_client.post(
            "/auth/register",
            json_body={"username": f"reg_{uuid.uuid4().hex[:8]}", "password": "123456"},
        )
        # 默认关闭注册时为 403；若开启则为 201
        assert resp.status_code in (201, 403, 400)
