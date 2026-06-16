"""章节管理模块测试 - 覆盖章节 CRUD 和文件操作"""
import pytest
from urllib.parse import quote
from conftest import unique_title


class TestChapterCRUD:
    """章节增删改查"""

    def test_create_chapter(self, admin_client, novel_project):
        """TC-CH-01: 创建新章节"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/manuscripts", json_body={
            "title": "第一章 测试", "content": "# 第一章\n\n测试内容。"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("filename")

    def test_list_chapters(self, admin_client, novel_project, chapter_file):
        """TC-CH-02: 列出所有章节"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/chapters")
        assert resp.status_code == 200
        data = resp.json()
        chapters = data if isinstance(data, list) else data.get("chapters", [])
        assert len(chapters) > 0

    def test_read_chapter(self, admin_client, novel_project, chapter_file):
        """TC-CH-03: 读取章节内容"""
        pid, fn = chapter_file
        resp = admin_client.get(f"/projects/{pid}/chapters/{quote(fn, safe='')}")
        assert resp.status_code == 200
        data = resp.json()
        assert "content" in data
        assert len(data["content"]) > 0

    def test_update_chapter(self, admin_client, novel_project, chapter_file):
        """TC-CH-04: 更新章节内容"""
        pid, fn = chapter_file
        resp = admin_client.put(
            f"/projects/{pid}/chapters/{quote(fn, safe='')}",
            json_body={"content": "# 第一章\n\n更新后的内容。"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "filename" in data

    def test_delete_chapter(self, admin_client, novel_project):
        """TC-CH-05: 删除章节"""
        pid = novel_project["id"]
        # 先创建
        resp = admin_client.post(f"/projects/{pid}/manuscripts", json_body={
            "title": "待删除章节", "content": "临时内容"
        })
        assert resp.status_code == 200
        fn = resp.json()["filename"]

        # 删除
        resp = admin_client.delete(f"/projects/{pid}/chapters/{quote(fn, safe='')}")
        assert resp.status_code == 200

    def test_export_chapter_md(self, admin_client, novel_project, chapter_file):
        """TC-CH-06: 导出章节为 Markdown"""
        pid, fn = chapter_file
        resp = admin_client.get(
            f"/projects/{pid}/chapters/{quote(fn, safe='')}/export",
            query={"format": "md"}
        )
        assert resp.status_code == 200


class TestWorkspaceFiles:
    """工作区文件操作"""

    def test_list_manuscript_files(self, admin_client, novel_project):
        """TC-CH-07: 列出正文文件"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/files/manuscript")
        assert resp.status_code == 200

    def test_list_settings_files(self, admin_client, novel_project):
        """TC-CH-08: 列出设定文件"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/files/settings")
        assert resp.status_code == 200

    def test_list_outline_files(self, admin_client, novel_project):
        """TC-CH-09: 列出大纲文件"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/files/outline")
        assert resp.status_code == 200

    def test_create_settings_file(self, admin_client, novel_project):
        """TC-CH-10: 创建设定文件"""
        pid = novel_project["id"]
        resp = admin_client.put(
            f"/projects/{pid}/files/settings/角色设定.md",
            json_body={"content": "# 角色设定\n\n## 主角\n- 名字：林风"}
        )
        assert resp.status_code == 200

    def test_read_settings_file(self, admin_client, novel_project):
        """TC-CH-11: 读取设定文件"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/files/settings/角色设定.md")
        assert resp.status_code == 200

    def test_create_outline_file(self, admin_client, novel_project):
        """TC-CH-12: 创建大纲文件"""
        pid = novel_project["id"]
        resp = admin_client.put(
            f"/projects/{pid}/files/outline/总纲.md",
            json_body={"content": "# 总纲\n\n少年修炼的故事。"}
        )
        assert resp.status_code == 200

    def test_read_outline_file(self, admin_client, novel_project):
        """TC-CH-13: 读取大纲文件"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/files/outline/总纲.md")
        assert resp.status_code == 200
