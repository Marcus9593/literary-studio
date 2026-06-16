"""项目管理模块测试 - 覆盖所有 /projects 端点"""
import pytest
from helpers.client import ApiClient
from conftest import unique_title


class TestProjectCRUD:
    """项目增删改查"""

    def test_create_project(self, admin_client):
        """TC-PROJ-01: 创建长篇小说项目"""
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("novel"), "work_type": "novel_long", "creation_mode": "scratch", "genre": "玄幻"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("title")
        assert data.get("id")
        admin_client.delete(f"/projects/{data['id']}")

    def test_create_screenplay_project(self, admin_client):
        """TC-PROJ-02: 创建电影剧本项目"""
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("film"), "work_type": "screenplay_film", "creation_mode": "scratch"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("work_type") == "screenplay_film"
        admin_client.delete(f"/projects/{data['id']}")

    def test_create_series_project(self, admin_client):
        """TC-PROJ-03: 创建剧集剧本项目"""
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("series"), "work_type": "screenplay_series", "creation_mode": "scratch"
        })
        assert resp.status_code == 200
        admin_client.delete(f"/projects/{resp.json()['id']}")

    def test_create_web_short_project(self, admin_client):
        """TC-PROJ-04: 创建短视频脚本项目"""
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("short"), "work_type": "web_short", "creation_mode": "scratch"
        })
        assert resp.status_code == 200
        admin_client.delete(f"/projects/{resp.json()['id']}")

    def test_list_projects(self, admin_client, novel_project):
        """TC-PROJ-05: 获取项目列表"""
        resp = admin_client.get("/projects")
        assert resp.status_code == 200
        data = resp.json()
        projects = data if isinstance(data, list) else data.get("projects", [])
        assert len(projects) > 0

    def test_get_project_detail(self, admin_client, novel_project):
        """TC-PROJ-06: 获取项目详情"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("id") == pid
        assert "title" in data

    def test_update_project(self, admin_client, novel_project):
        """TC-PROJ-07: 更新项目信息"""
        pid = novel_project["id"]
        new_title = unique_title("updated")
        resp = admin_client.patch(f"/projects/{pid}", json_body={"title": new_title})
        assert resp.status_code == 200
        assert resp.json().get("title") == new_title

    def test_update_project_genre(self, admin_client, novel_project):
        """TC-PROJ-08: 更新项目题材"""
        pid = novel_project["id"]
        resp = admin_client.patch(f"/projects/{pid}", json_body={"genre": "都市"})
        assert resp.status_code == 200

    def test_delete_project(self, admin_client):
        """TC-PROJ-09: 删除项目"""
        # 创建一个临时项目
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("to_delete"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        assert resp.status_code == 200
        pid = resp.json()["id"]

        # 删除
        resp = admin_client.delete(f"/projects/{pid}")
        assert resp.status_code == 200

    def test_get_nonexistent_project(self, admin_client):
        """TC-PROJ-10: 获取不存在的项目返回 404"""
        resp = admin_client.get("/projects/nonexistent-id-12345")
        assert resp.status_code in (404, 400)


class TestProjectShare:
    """项目分享"""

    def test_get_shares(self, admin_client, novel_project):
        """TC-PROJ-11: 获取项目分享信息"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/shares")
        assert resp.status_code == 200

    def test_search_project(self, admin_client, novel_project):
        """TC-PROJ-12: 搜索项目内容"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/search", query={"q": "测试"})
        assert resp.status_code == 200

    def test_get_takeover_report(self, admin_client, novel_project):
        """TC-PROJ-13: 获取项目诊断报告"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/takeover")
        assert resp.status_code == 200
