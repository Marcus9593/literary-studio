"""Pytest fixtures for Literary Studio API integration tests."""
from __future__ import annotations

import uuid

import pytest
import requests

from config import ADMIN_PASSWORD, ADMIN_USERNAME, BASE_URL
from helpers.client import ApiClient


def _server_available() -> bool:
    """检查服务是否可用"""
    try:
        resp = requests.get(f"{BASE_URL}/api/health", timeout=5)
        return resp.status_code == 200
    except requests.RequestException:
        return False


@pytest.fixture(scope="session")
def require_server():
    """跳过测试如果服务未运行"""
    if not _server_available():
        pytest.skip(f"文匠 Studio 后端未运行 ({BASE_URL})")


@pytest.fixture(scope="session")
def anon_client(require_server) -> ApiClient:
    """未认证的客户端"""
    return ApiClient()


@pytest.fixture(scope="session")
def admin_client(require_server) -> ApiClient:
    """管理员客户端（已登录）"""
    client = ApiClient()
    client.login(ADMIN_USERNAME, ADMIN_PASSWORD)
    return client


@pytest.fixture(scope="session")
def admin_token(admin_client) -> str:
    """管理员 Token"""
    assert admin_client.token
    return admin_client.token


# ── 项目 Fixtures ──

@pytest.fixture(scope="session")
def novel_project(admin_client) -> dict:
    """创建一个长篇小说项目"""
    title = f"pytest-novel-{uuid.uuid4().hex[:8]}"
    resp = admin_client.post("/projects", json_body={
        "title": title, "genre": "玄幻", "work_type": "novel_long", "creation_mode": "scratch",
    })
    resp.raise_for_status()
    project = resp.json()
    yield project
    admin_client.delete(f"/projects/{project['id']}")


@pytest.fixture(scope="session")
def screenplay_project(admin_client) -> dict:
    """创建一个电影剧本项目"""
    title = f"pytest-screenplay-{uuid.uuid4().hex[:8]}"
    resp = admin_client.post("/projects", json_body={
        "title": title, "genre": "悬疑", "work_type": "screenplay_film", "creation_mode": "scratch",
    })
    resp.raise_for_status()
    project = resp.json()
    yield project
    admin_client.delete(f"/projects/{project['id']}")


@pytest.fixture(scope="session")
def series_project(admin_client) -> dict:
    """创建一个剧集剧本项目"""
    title = f"pytest-series-{uuid.uuid4().hex[:8]}"
    resp = admin_client.post("/projects", json_body={
        "title": title, "genre": "都市", "work_type": "screenplay_series", "creation_mode": "scratch",
    })
    resp.raise_for_status()
    project = resp.json()
    yield project
    admin_client.delete(f"/projects/{project['id']}")


@pytest.fixture(scope="session")
def web_short_project(admin_client) -> dict:
    """创建一个短视频脚本项目"""
    title = f"pytest-webshort-{uuid.uuid4().hex[:8]}"
    resp = admin_client.post("/projects", json_body={
        "title": title, "genre": "搞笑", "work_type": "web_short", "creation_mode": "scratch",
    })
    resp.raise_for_status()
    project = resp.json()
    yield project
    admin_client.delete(f"/projects/{project['id']}")


# ── 章节 Fixtures ──

@pytest.fixture(scope="session")
def chapter_file(admin_client, novel_project) -> tuple[str, str]:
    """创建一个测试章节，返回 (project_id, filename)"""
    pid = novel_project["id"]
    resp = admin_client.post(f"/projects/{pid}/manuscripts", json_body={
        "title": "第一章 测试章节",
        "content": "# 第一章\n\n主角林风站在山巅，望着远方的城市。风很大，他的衣角猎猎作响。\n\n这是一个测试章节。",
    })
    resp.raise_for_status()
    filename = resp.json().get("filename") or resp.json().get("chapter")
    assert filename
    return pid, filename


# ── 会话 Fixtures ──

@pytest.fixture(scope="session")
def session_id(admin_client, novel_project) -> tuple[str, str]:
    """创建一个测试会话，返回 (project_id, session_id)"""
    pid = novel_project["id"]
    resp = admin_client.post(f"/projects/{pid}/sessions", json_body={"title": "pytest-session"})
    resp.raise_for_status()
    sid = resp.json().get("id") or resp.json().get("session_id")
    assert sid
    return pid, sid


# ── 版本 Fixtures ──

@pytest.fixture(scope="session")
def version_id(admin_client, novel_project) -> tuple[str, str]:
    """创建一个版本快照，返回 (project_id, version_id)"""
    pid = novel_project["id"]
    resp = admin_client.post(f"/projects/{pid}/versions/create", json_body={"title": "pytest-snapshot"})
    resp.raise_for_status()
    vid = resp.json().get("id") or resp.json().get("version_id")
    assert vid
    return pid, vid


# ── 编剧 Fixtures ──

@pytest.fixture(scope="session")
def canon_rule_id(admin_client, novel_project) -> tuple[str, int]:
    """创建一个 Canon 规则，返回 (project_id, rule_id)"""
    pid = novel_project["id"]
    resp = admin_client.post(f"/projects/{pid}/engine/canon", json_body={
        "title": "测试规则", "content": "魔法消耗寿命", "immutability": "immutable",
    })
    resp.raise_for_status()
    rule_id = resp.json().get("id")
    assert rule_id is not None
    return pid, int(rule_id)


@pytest.fixture(scope="session")
def scene_id(admin_client, screenplay_project) -> tuple[str, str]:
    """创建一个场景，返回 (project_id, scene_id)"""
    pid = screenplay_project["id"]
    resp = admin_client.post(f"/projects/{pid}/screenplay/scenes", json_body={
        "location": "咖啡厅", "int_ext": "INT", "time_of_day": "日",
    })
    resp.raise_for_status()
    sid = resp.json()["id"]
    return pid, sid


# ── 工具函数 ──

def unique_title(prefix: str = "test") -> str:
    """生成唯一的标题"""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"
