"""Screenplay & Guestbook API tests."""
from __future__ import annotations

import uuid

from config import FAKE_FORESHADOW_ID, FAKE_POST_ID, FAKE_PROJECT_ID, FAKE_SCENE_ID


class TestScreenplayFilm:
    def test_screenplay_get_positive(self, admin_client, screenplay_project):
        resp = admin_client.get(f"/projects/{screenplay_project['id']}/screenplay")
        assert resp.status_code == 200

    def test_screenplay_get_negative_novel_project(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/screenplay")
        assert resp.status_code == 404

    def test_screenplay_stats_positive(self, admin_client, screenplay_project):
        resp = admin_client.get(f"/projects/{screenplay_project['id']}/screenplay/stats")
        assert resp.status_code == 200

    def test_scene_create_positive(self, admin_client, screenplay_project):
        resp = admin_client.post(
            f"/projects/{screenplay_project['id']}/screenplay/scenes",
            json_body={"location": "咖啡馆", "int_ext": "INT", "time_of_day": "日"},
        )
        assert resp.status_code == 200
        assert "id" in resp.json()

    def test_scene_patch_positive(self, admin_client, screenplay_project):
        pid = screenplay_project["id"]
        created = admin_client.post(
            f"/projects/{pid}/screenplay/scenes",
            json_body={"location": "补丁测试场景"},
        )
        assert created.status_code == 200
        sid = created.json()["id"]
        resp = admin_client.patch(
            f"/projects/{pid}/screenplay/scenes/{sid}",
            json_body={"synopsis": "两人相遇"},
        )
        assert resp.status_code == 200

    def test_scene_delete_negative_not_found(self, admin_client, screenplay_project):
        resp = admin_client.delete(
            f"/projects/{screenplay_project['id']}/screenplay/scenes/{FAKE_SCENE_ID}"
        )
        assert resp.status_code == 404

    def test_scenes_reorder_negative_invalid_body(self, admin_client, screenplay_project):
        resp = admin_client.post(
            f"/projects/{screenplay_project['id']}/screenplay/scenes/reorder",
            json_body={"order": "not-array"},
        )
        assert resp.status_code == 400

    def test_storylines_put_positive(self, admin_client, screenplay_project):
        resp = admin_client.put(
            f"/projects/{screenplay_project['id']}/screenplay/storylines",
            json_body=[{"id": "main", "name": "主线", "color": "#ff0000"}],
        )
        assert resp.status_code == 200

    def test_characters_positive(self, admin_client, screenplay_project):
        resp = admin_client.get(f"/projects/{screenplay_project['id']}/screenplay/characters")
        assert resp.status_code == 200

    def test_foreshadows_create_positive(self, admin_client, screenplay_project):
        resp = admin_client.post(
            f"/projects/{screenplay_project['id']}/screenplay/foreshadows",
            json_body={"title": "神秘信件", "description": "第一幕出现"},
        )
        assert resp.status_code == 200

    def test_foreshadows_patch_negative_not_found(self, admin_client, screenplay_project):
        resp = admin_client.patch(
            f"/projects/{screenplay_project['id']}/screenplay/foreshadows/{FAKE_FORESHADOW_ID}",
            json_body={"title": "x"},
        )
        assert resp.status_code == 404

    def test_export_fountain_positive(self, admin_client, screenplay_project):
        resp = admin_client.get(
            f"/projects/{screenplay_project['id']}/screenplay/export/fountain",
            raw=True,
        )
        assert resp.status_code in (200, 400)


class TestScreenplayWebShort:
    def test_platform_put_positive(self, admin_client, web_short_project):
        resp = admin_client.put(
            f"/projects/{web_short_project['id']}/screenplay/platform",
            json_body={"platform": "douyin", "target_duration": 60},
        )
        assert resp.status_code == 200

    def test_rhythm_positive(self, admin_client, web_short_project):
        resp = admin_client.get(f"/projects/{web_short_project['id']}/screenplay/rhythm")
        assert resp.status_code == 200

    def test_shots_create_positive(self, admin_client, web_short_project):
        resp = admin_client.post(
            f"/projects/{web_short_project['id']}/screenplay/shots",
            json_body={"title": "开场镜头", "duration": 3},
        )
        assert resp.status_code == 200


class TestGuestbook:
    def test_list_positive(self, admin_client):
        resp = admin_client.get("/guestbook/", query={"page": 1, "limit": 5})
        assert resp.status_code == 200

    def test_list_negative_unauthenticated(self, anon_client):
        resp = anon_client.get("/guestbook/")
        assert resp.status_code == 401

    def test_create_positive(self, admin_client):
        resp = admin_client.post(
            "/guestbook/",
            files={"content": (None, f"pytest留言-{uuid.uuid4().hex[:6]}")},
        )
        assert resp.status_code == 201

    def test_create_negative_empty_content(self, admin_client):
        resp = admin_client.post("/guestbook/", files={"content": (None, "")})
        assert resp.status_code == 400

    def test_reply_negative_post_not_found(self, admin_client):
        resp = admin_client.post(
            f"/guestbook/{FAKE_POST_ID}/replies",
            files={"content": (None, "回复测试")},
        )
        assert resp.status_code in (400, 404)

    def test_delete_post_negative_not_found(self, admin_client):
        resp = admin_client.delete(f"/guestbook/{FAKE_POST_ID}")
        assert resp.status_code in (400, 404)

    def test_media_negative_not_found(self, anon_client):
        resp = anon_client.get("/guestbook/media/nonexistent-file.png")
        assert resp.status_code == 404
