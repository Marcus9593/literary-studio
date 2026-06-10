"""Pytest fixtures for Literary Studio API integration tests."""
from __future__ import annotations

import uuid

import pytest
import requests

from config import ADMIN_PASSWORD, ADMIN_USERNAME, BASE_URL, FAKE_PROJECT_ID
from helpers.client import ApiClient


def _server_available() -> bool:
    try:
        resp = requests.get(f"{BASE_URL}/api/health", timeout=3)
        return resp.status_code == 200
    except requests.RequestException:
        return False


@pytest.fixture(scope="session")
def require_server():
    if not _server_available():
        pytest.skip(f"Literary Studio 后端未运行，请先启动服务 ({BASE_URL})")


@pytest.fixture(scope="session")
def anon_client(require_server) -> ApiClient:
    return ApiClient()


@pytest.fixture(scope="session")
def admin_client(require_server) -> ApiClient:
    client = ApiClient()
    client.login(ADMIN_USERNAME, ADMIN_PASSWORD)
    return client


@pytest.fixture(scope="session")
def admin_token(admin_client) -> str:
    assert admin_client.token
    return admin_client.token


def _create_project(client: ApiClient, body: dict, retries: int = 3) -> dict:
    last = None
    for _ in range(retries):
        resp = client.post("/projects", json_body=body)
        last = resp
        if resp.status_code == 200:
            return resp.json()
    assert last is not None
    pytest.fail(f"创建项目失败: {last.status_code} {last.text[:300]}")


def _try_create_project(client: ApiClient, body: dict) -> dict | None:
    resp = client.post("/projects", json_body=body)
    if resp.status_code == 200:
        return resp.json()
    return None


@pytest.fixture(scope="session")
def novel_project(admin_client) -> dict:
    title = f"pytest-novel-{uuid.uuid4().hex[:8]}"
    project = _create_project(
        admin_client,
        {"title": title, "genre": "测试", "work_type": "novel_long"},
    )
    yield project
    admin_client.delete(f"/projects/{project['id']}")


@pytest.fixture(scope="session")
def screenplay_project(admin_client) -> dict:
    title = f"pytest-screenplay-{uuid.uuid4().hex[:8]}"
    project = _create_project(
        admin_client,
        {"title": title, "genre": "测试", "work_type": "screenplay_film"},
    )
    yield project
    admin_client.delete(f"/projects/{project['id']}")


@pytest.fixture(scope="session")
def web_short_project(admin_client) -> dict:
    title = f"pytest-webshort-{uuid.uuid4().hex[:8]}"
    project = _create_project(
        admin_client,
        {"title": title, "genre": "测试", "work_type": "web_short"},
    )
    yield project
    admin_client.delete(f"/projects/{project['id']}")


@pytest.fixture(scope="session")
def chapter_file(admin_client, novel_project) -> tuple[str, str]:
    """Return (project_id, chapter_filename)."""
    pid = novel_project["id"]
    resp = admin_client.post(
        f"/projects/{pid}/manuscripts",
        json_body={"title": "测试章", "content": "# 测试章\n\n正文内容。"},
    )
    assert resp.status_code == 200, resp.text
    filename = resp.json().get("filename") or resp.json().get("chapter")
    assert filename
    return pid, filename


@pytest.fixture(scope="session")
def session_id(admin_client, novel_project) -> tuple[str, str]:
    pid = novel_project["id"]
    resp = admin_client.post(f"/projects/{pid}/sessions", json_body={"title": "pytest-session"})
    assert resp.status_code == 200, resp.text
    sid = resp.json().get("id") or resp.json().get("session_id")
    assert sid
    return pid, sid


@pytest.fixture(scope="session")
def version_id(admin_client, novel_project) -> tuple[str, str]:
    pid = novel_project["id"]
    resp = admin_client.post(f"/projects/{pid}/versions/create", json_body={"label": "pytest-snapshot"})
    assert resp.status_code == 200, resp.text
    vid = resp.json().get("id") or resp.json().get("version_id")
    assert vid
    return pid, vid


@pytest.fixture(scope="session")
def canon_rule_id(admin_client, novel_project) -> tuple[str, int]:
    pid = novel_project["id"]
    resp = admin_client.post(
        f"/projects/{pid}/engine/canon",
        json_body={"category": "world", "rule": "pytest rule", "severity": "hard"},
    )
    assert resp.status_code == 200, resp.text
    rule_id = resp.json().get("id")
    assert rule_id is not None
    return pid, int(rule_id)


@pytest.fixture(scope="session")
def scene_id(admin_client, screenplay_project) -> tuple[str, str]:
    pid = screenplay_project["id"]
    resp = admin_client.post(
        f"/projects/{pid}/screenplay/scenes",
        json_body={"location": "测试场景", "int_ext": "INT", "time_of_day": "日"},
    )
    assert resp.status_code == 200, resp.text
    sid = resp.json()["id"]
    return pid, sid


@pytest.fixture
def fake_project_id() -> str:
    return FAKE_PROJECT_ID
