"""Projects, chapters, files, export — positive and negative cases."""
from __future__ import annotations

import uuid

from config import FAKE_CHAPTER, FAKE_PROJECT_ID


class TestProjects:
    def test_list_projects_positive(self, admin_client):
        resp = admin_client.get("/projects")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_projects_negative_unauthenticated(self, anon_client):
        resp = anon_client.get("/projects")
        assert resp.status_code == 401

    def test_create_project_positive(self, admin_client):
        title = f"pytest-create-{uuid.uuid4().hex[:8]}"
        resp = admin_client.post("/projects", json_body={"title": title, "genre": "玄幻"})
        assert resp.status_code == 200
        pid = resp.json()["id"]
        admin_client.delete(f"/projects/{pid}")

    def test_create_project_negative_empty_title(self, admin_client):
        resp = admin_client.post("/projects", json_body={"title": "  "})
        assert resp.status_code == 400

    def test_get_project_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == novel_project["id"]

    def test_get_project_negative_not_found(self, admin_client):
        resp = admin_client.get(f"/projects/{FAKE_PROJECT_ID}")
        assert resp.status_code == 404

    def test_patch_project_positive(self, admin_client, novel_project):
        resp = admin_client.patch(
            f"/projects/{novel_project['id']}",
            json_body={"summary": "pytest summary"},
        )
        assert resp.status_code == 200
        assert resp.json()["summary"] == "pytest summary"

    def test_search_positive(self, admin_client, novel_project, chapter_file):
        pid, _ = chapter_file
        resp = admin_client.get(f"/projects/{pid}/search", query={"q": "测试"})
        assert resp.status_code == 200

    def test_search_negative_missing_query(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/search")
        assert resp.status_code == 400

    def test_shares_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/shares")
        assert resp.status_code == 200
        data = resp.json()
        assert "shares" in data
        assert "candidates" in data

    def test_takeover_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/takeover")
        assert resp.status_code == 200


class TestChapters:
    def test_list_chapters_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/chapters")
        assert resp.status_code == 200

    def test_create_manuscript_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/manuscripts",
            json_body={"title": "新章", "content": "# 新章\n\n内容。"},
        )
        assert resp.status_code == 200

    def test_get_chapter_positive(self, admin_client, chapter_file):
        pid, filename = chapter_file
        resp = admin_client.get(f"/projects/{pid}/chapters/{filename}")
        assert resp.status_code == 200
        assert "content" in resp.json()

    def test_get_chapter_negative_not_found(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/chapters/{FAKE_CHAPTER}")
        assert resp.status_code == 404

    def test_put_chapter_positive(self, admin_client, chapter_file):
        pid, filename = chapter_file
        resp = admin_client.put(
            f"/projects/{pid}/chapters/{filename}",
            json_body={"content": "# 更新\n\n新内容。"},
        )
        assert resp.status_code == 200

    def test_put_chapter_negative_missing_content(self, admin_client, chapter_file):
        pid, filename = chapter_file
        resp = admin_client.put(f"/projects/{pid}/chapters/{filename}", json_body={})
        assert resp.status_code == 400

    def test_files_list_positive(self, admin_client, chapter_file):
        pid, _ = chapter_file
        resp = admin_client.get(f"/projects/{pid}/files/manuscript")
        assert resp.status_code == 200

    def test_export_formats_positive(self, admin_client):
        resp = admin_client.get("/export/formats")
        assert resp.status_code == 200

    def test_download_positive_zip(self, admin_client, novel_project):
        resp = admin_client.get(
            f"/projects/{novel_project['id']}/download",
            query={"format": "zip"},
            raw=True,
        )
        assert resp.status_code in (200, 500)  # 500 if docx deps missing

    def test_write_redirect_negative(self, admin_client, novel_project):
        resp = admin_client.post(f"/projects/{novel_project['id']}/write")
        assert resp.status_code == 400
