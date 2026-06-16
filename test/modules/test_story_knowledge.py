"""故事知识库测试 - 覆盖所有 /story/knowledge 端点"""
import pytest


class TestKnowledgeBase:
    """知识库操作"""

    def test_get_knowledge(self, admin_client, novel_project):
        """TC-KB-01: 获取知识库"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/knowledge")
        assert resp.status_code == 200
        data = resp.json()
        assert "characters" in data
        assert "relationships" in data
        assert "foreshadows" in data

    def test_update_knowledge(self, admin_client, novel_project):
        """TC-KB-02: 更新知识库（添加角色）"""
        pid = novel_project["id"]
        resp = admin_client.put(f"/projects/{pid}/story/knowledge", json_body={
            "characters": {"items": [{"name": "林风", "role": "主角"}]}
        })
        assert resp.status_code == 200

    def test_rebuild_knowledge(self, admin_client, novel_project):
        """TC-KB-03: 重建知识库"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/story/knowledge/rebuild")
        assert resp.status_code == 200

    def test_query_story_index(self, admin_client, novel_project):
        """TC-KB-04: 查询故事索引"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/index/query", query={"q": "林风"})
        assert resp.status_code == 200

    def test_query_character(self, admin_client, novel_project):
        """TC-KB-05: 查询角色"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/index/character", query={"q": "林风"})
        assert resp.status_code == 200

    def test_query_relationship(self, admin_client, novel_project):
        """TC-KB-06: 查询关系"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/index/relationship", query={"q": "师徒"})
        assert resp.status_code == 200

    def test_query_timeline(self, admin_client, novel_project):
        """TC-KB-07: 查询时间线"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/index/timeline", query={"q": "突破"})
        assert resp.status_code == 200

    def test_query_foreshadow(self, admin_client, novel_project):
        """TC-KB-08: 查询伏笔"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/index/foreshadow", query={"q": "玉佩"})
        assert resp.status_code == 200

    def test_query_location(self, admin_client, novel_project):
        """TC-KB-09: 查询地点"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/index/location", query={"q": "青云城"})
        assert resp.status_code == 200

    def test_get_summaries(self, admin_client, novel_project):
        """TC-KB-10: 获取摘要"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/summaries")
        assert resp.status_code == 200

    def test_rebuild_summaries(self, admin_client, novel_project):
        """TC-KB-11: 重建摘要"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/story/summaries/rebuild")
        assert resp.status_code == 200
