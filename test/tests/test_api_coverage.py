"""Automated API coverage: auth boundary + positive smoke tests from endpoint catalog."""
from __future__ import annotations

import json
import uuid

import pytest

from config import (
    FAKE_ACTION_ID,
    FAKE_ASSET_ID,
    FAKE_CHARACTER_ID,
    FAKE_CHAPTER,
    FAKE_EPISODE_ID,
    FAKE_FORESHADOW_ID,
    FAKE_JOB_ID,
    FAKE_MODEL_ID,
    FAKE_PLAN_ID,
    FAKE_POST_ID,
    FAKE_PROJECT_ID,
    FAKE_REPLY_ID,
    FAKE_RULE_ID,
    FAKE_RUN_ID,
    FAKE_SCENE_ID,
    FAKE_SECTION_ID,
    FAKE_SESSION_ID,
    FAKE_SHOT_ID,
    FAKE_SKILL_ID,
    FAKE_SNAPSHOT_ID,
    FAKE_TASK_ID,
    FAKE_USER_ID,
    FAKE_VERSION_ID,
)
from endpoints.catalog import ALL_ENDPOINTS, AuthLevel, EndpointSpec, resolve_body, resolve_path
from helpers.client import ApiClient


def _build_context(
    novel_project: dict,
    screenplay_project: dict,
    web_short_project: dict,
    chapter_file: tuple[str, str],
    session_id: tuple[str, str],
    version_id: tuple[str, str],
    canon_rule_id: tuple[str, int],
    scene_id: tuple[str, str],
) -> dict[str, str]:
    _, chapter = chapter_file
    _, sid = session_id
    _, vid = version_id
    _, rule_id = canon_rule_id
    spid, scid = scene_id
    return {
        "project_id": novel_project["id"],
        "screenplay_project_id": screenplay_project["id"],
        "web_short_project_id": web_short_project["id"],
        "chapter": chapter,
        "session_id": sid,
        "version_id": vid,
        "plan_id": FAKE_PLAN_ID,
        "rule_id": str(rule_id),
        "run_id": FAKE_RUN_ID,
        "unit_index": "1",
        "character_id": FAKE_CHARACTER_ID,
        "section_id": FAKE_SECTION_ID,
        "scene_id": scid,
        "episode_id": FAKE_EPISODE_ID,
        "foreshadow_id": FAKE_FORESHADOW_ID,
        "character_name": "主角",
        "shot_id": FAKE_SHOT_ID,
        "task_id": FAKE_TASK_ID,
        "action_id": FAKE_ACTION_ID,
        "job_id": FAKE_JOB_ID,
        "model_id": FAKE_MODEL_ID,
        "server_id": "studio",
        "skill_id": "literary-writer",
        "snapshot_id": FAKE_SNAPSHOT_ID,
        "asset_id": FAKE_ASSET_ID,
        "post_id": FAKE_POST_ID,
        "reply_id": FAKE_REPLY_ID,
        "user_id": FAKE_USER_ID,
        "filename": "nonexistent.md",
    }


@pytest.fixture(scope="module")
def api_context(
    novel_project,
    screenplay_project,
    web_short_project,
    chapter_file,
    session_id,
    version_id,
    canon_rule_id,
    scene_id,
):
    return _build_context(
        novel_project,
        screenplay_project,
        web_short_project,
        chapter_file,
        session_id,
        version_id,
        canon_rule_id,
        scene_id,
    )


def _guestbook_post(client: ApiClient, path: str, content: str):
    # 留言板路由使用 multer，须 multipart/form-data 才能读到 content 字段
    return client.post(path, files={"content": (None, content)})


def _prepare_smoke_context(client: ApiClient, spec: EndpointSpec, ctx: dict[str, str]) -> dict[str, str]:
    """为破坏性冒烟测试准备独立资源，避免删除共享 fixture 项目。"""
    prepared = dict(ctx)
    if spec.module == "projects" and spec.name == "delete":
        resp = client.post("/projects", json_body={"title": f"tmp-del-{uuid.uuid4().hex[:6]}"})
        if resp.status_code == 200:
            prepared["project_id"] = resp.json()["id"]
    elif spec.module == "chapters" and spec.name == "delete":
        pid = prepared["project_id"]
        resp = client.post(
            f"/projects/{pid}/manuscripts",
            json_body={"title": "待删章", "content": "临时章节"},
        )
        if resp.status_code == 200:
            fn = resp.json().get("filename") or resp.json().get("chapter")
            if fn:
                prepared["chapter"] = fn
    elif spec.module == "versions" and spec.name == "delete":
        pid = prepared["project_id"]
        resp = client.post(f"/projects/{pid}/versions/create", json_body={"label": "tmp"})
        if resp.status_code == 200:
            prepared["version_id"] = resp.json().get("id") or resp.json().get("version_id") or prepared["version_id"]
    elif spec.module == "screenplay" and spec.name == "scenes_delete":
        pid = prepared["screenplay_project_id"]
        resp = client.post(
            f"/projects/{pid}/screenplay/scenes",
            json_body={"location": "待删场景"},
        )
        if resp.status_code == 200:
            prepared["scene_id"] = resp.json().get("id", prepared["scene_id"])
    elif spec.module == "chat" and spec.name == "sessions_delete":
        pid = prepared["project_id"]
        resp = client.post(f"/projects/{pid}/sessions", json_body={"title": "tmp-session"})
        if resp.status_code == 200:
            prepared["session_id"] = resp.json().get("id") or resp.json().get("session_id") or prepared["session_id"]
    elif spec.module == "auth" and spec.name == "update_user":
        resp = client.post(
            "/auth/users",
            json_body={"username": f"tmp_{uuid.uuid4().hex[:8]}", "password": "123456"},
        )
        if resp.status_code == 201:
            prepared["user_id"] = resp.json()["id"]
    elif spec.module == "guestbook" and spec.name == "reply":
        resp = _guestbook_post(client, "/guestbook/", f"post-for-reply-{uuid.uuid4().hex[:6]}")
        if resp.status_code == 201:
            prepared["post_id"] = resp.json().get("id", prepared["post_id"])
    elif spec.module == "guestbook" and spec.name in ("delete_post", "delete_reply"):
        resp = _guestbook_post(client, "/guestbook/", f"post-to-delete-{uuid.uuid4().hex[:6]}")
        if resp.status_code == 201:
            prepared["post_id"] = resp.json().get("id", prepared["post_id"])
            if spec.name == "delete_reply":
                r2 = _guestbook_post(
                    client,
                    f"/guestbook/{prepared['post_id']}/replies",
                    "reply to delete",
                )
                if r2.status_code == 201:
                    prepared["reply_id"] = r2.json().get("id", prepared["reply_id"])
    elif spec.module == "studio" and spec.name in ("snapshots_create", "snapshots_delete", "snapshots_diff", "snapshots_restore"):
        pid = prepared["project_id"]
        resp = client.post("/studio/snapshots", json_body={"project_id": pid, "label": "tmp"})
        if resp.status_code == 200:
            prepared["snapshot_id"] = resp.json().get("id") or prepared["snapshot_id"]
    elif spec.module == "studio" and spec.name in ("assets_create", "assets_delete", "assets_update"):
        pid = prepared["project_id"]
        resp = client.post(
            "/studio/assets",
            json_body={"project_id": pid, "type": "note", "title": "tmp asset"},
        )
        if resp.status_code == 200:
            prepared["asset_id"] = resp.json().get("id") or prepared["asset_id"]
    return prepared


def _call(client: ApiClient, spec: EndpointSpec, ctx: dict[str, str]):
    path = resolve_path(spec.path, ctx)
    body = resolve_body(spec.json_body, ctx)
    query = resolve_body(spec.query, ctx) if spec.query else None

    if spec.module == "guestbook" and spec.name == "create":
        return _guestbook_post(client, path, f"pytest-{uuid.uuid4().hex[:6]}")
    if spec.module == "guestbook" and spec.name == "reply":
        return _guestbook_post(client, path, "reply test")

    kwargs = {}
    if body is not None:
        kwargs["json_body"] = body
    if query:
        kwargs["query"] = query
    return client.request(spec.method, path, **kwargs)


@pytest.mark.parametrize("spec", ALL_ENDPOINTS, ids=lambda s: f"{s.module}.{s.name}")
def test_endpoint_positive_smoke(spec: EndpointSpec, admin_client, api_context):
    """正例：已认证管理员调用，期望返回成功或业务可接受的状态码。"""
    if spec.auth == AuthLevel.PUBLIC and spec.name in ("login", "register"):
        pytest.skip("登录/注册在专项测试中覆盖")

    ctx = _prepare_smoke_context(admin_client, spec, api_context)
    resp = _call(admin_client, spec, ctx)
    assert resp.status_code in spec.positive_status, (
        f"{spec.method} {spec.path} -> {resp.status_code}: {resp.text[:300]}"
    )


@pytest.mark.parametrize(
    "spec",
    [s for s in ALL_ENDPOINTS if s.auth != AuthLevel.PUBLIC and not s.skip_auth_negative],
    ids=lambda s: f"{s.module}.{s.name}",
)
def test_endpoint_negative_no_auth(spec: EndpointSpec, anon_client, api_context):
    """反例：未登录访问受保护接口，期望 401。"""
    resp = _call(anon_client, spec, api_context)
    assert resp.status_code == 401, f"expected 401, got {resp.status_code}: {resp.text[:200]}"


@pytest.mark.parametrize(
    "spec",
    [s for s in ALL_ENDPOINTS if s.auth == AuthLevel.ADMIN],
    ids=lambda s: f"{s.module}.{s.name}",
)
def test_endpoint_negative_non_admin_forbidden(spec: EndpointSpec, admin_client, api_context):
    """反例：普通用户访问管理员接口 — 若无法创建用户则跳过。"""
    username = f"pytest_user_{uuid.uuid4().hex[:8]}"
    create = admin_client.post(
        "/auth/users",
        json_body={"username": username, "password": "123456", "display_name": "pytest"},
    )
    if create.status_code != 201:
        pytest.skip("无法创建普通用户用于权限测试")

    user_client = ApiClient()
    user_client.login(username, password="123456")
    resp = _call(user_client, spec, api_context)
    assert resp.status_code == 403, f"expected 403, got {resp.status_code}: {resp.text[:200]}"
    admin_client.delete(f"/auth/users/{create.json()['id']}")


@pytest.mark.parametrize(
    "spec",
    [
        s for s in ALL_ENDPOINTS
        if s.auth in (AuthLevel.PROJECT_READ, AuthLevel.PROJECT_WRITE, AuthLevel.PROJECT_MANAGE,
                      AuthLevel.SCREENPLAY, AuthLevel.SCREENPLAY_WRITE)
    ],
    ids=lambda s: f"{s.module}.{s.name}",
)
def test_endpoint_negative_fake_project(spec: EndpointSpec, admin_client):
    """反例：访问不存在项目，期望 404。"""
    fake_ctx = {
        "project_id": FAKE_PROJECT_ID,
        "screenplay_project_id": FAKE_PROJECT_ID,
        "web_short_project_id": FAKE_PROJECT_ID,
        "chapter": FAKE_CHAPTER,
        "session_id": FAKE_SESSION_ID,
        "version_id": FAKE_VERSION_ID,
        "plan_id": FAKE_PLAN_ID,
        "rule_id": FAKE_RULE_ID,
        "run_id": FAKE_RUN_ID,
        "unit_index": "1",
        "character_id": FAKE_CHARACTER_ID,
        "section_id": FAKE_SECTION_ID,
        "scene_id": FAKE_SCENE_ID,
        "episode_id": FAKE_EPISODE_ID,
        "foreshadow_id": FAKE_FORESHADOW_ID,
        "character_name": "x",
        "shot_id": FAKE_SHOT_ID,
        "task_id": FAKE_TASK_ID,
        "action_id": FAKE_ACTION_ID,
        "job_id": FAKE_JOB_ID,
        "model_id": FAKE_MODEL_ID,
        "server_id": "fake",
        "skill_id": FAKE_SKILL_ID,
        "snapshot_id": FAKE_SNAPSHOT_ID,
        "asset_id": FAKE_ASSET_ID,
        "post_id": FAKE_POST_ID,
        "reply_id": FAKE_REPLY_ID,
        "user_id": FAKE_USER_ID,
        "filename": FAKE_CHAPTER,
    }
    resp = _call(admin_client, spec, fake_ctx)
    assert resp.status_code in (404, 403, 500), (
        f"expected 404/403/500 for fake project, got {resp.status_code}: {resp.text[:200]}"
    )
