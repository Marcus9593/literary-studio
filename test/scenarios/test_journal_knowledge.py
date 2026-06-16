"""场景测试：日志与知识库联动"""
import pytest
from conftest import unique_title


class TestJournalKnowledgeIntegration:
    """日志 + 知识库联动：写日志 → 更新知识库 → 查询"""

    def test_journal_knowledge_flow(self, admin_client):
        """SC-JKB-01: 日志与知识库联动"""
        # 1. 创建项目
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("jkb"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        # 2. 写创作日志
        resp = admin_client.post("/guestbook", json_body={
            "content": "记录：第5章引入新角色赵天明，设定为反派", "tag": "进度"
        })
        assert resp.status_code == 201

        # 3. 更新知识库
        resp = admin_client.put(f"/projects/{pid}/story/knowledge", json_body={
            "characters": {"items": [
                {"name": "林风", "role": "主角"},
                {"name": "赵天明", "role": "反派"}
            ]}
        })
        assert resp.status_code == 200

        # 4. 查知识库
        resp = admin_client.get(f"/projects/{pid}/story/knowledge")
        assert resp.status_code == 200
        chars = resp.json().get("characters", {}).get("items", [])
        assert len(chars) >= 2

        # 5. 查日志
        resp = admin_client.get("/guestbook", query={"page": 1, "limit": 10})
        assert resp.status_code == 200
        items = resp.json().get("items", [])
        assert any("赵天明" in i.get("content", "") for i in items)

        admin_client.delete(f"/projects/{pid}")


class TestMultiTagJournal:
    """多标签日志管理"""

    def test_all_tags_workflow(self, admin_client):
        """SC-JKB-02: 多标签日志工作流"""
        tags_created = {}

        # 1. 创建所有标签
        for tag in ["灵感", "待办", "进度", "反馈", "其他"]:
            resp = admin_client.post("/guestbook", json_body={
                "content": f"测试{tag}标签内容", "tag": tag
            })
            assert resp.status_code == 201
            tags_created[tag] = resp.json()["id"]

        # 2. 置顶灵感
        admin_client.patch(f"/guestbook/{tags_created['灵感']}", json_body={"pinned": True})

        # 3. 编辑待办
        resp = admin_client.patch(f"/guestbook/{tags_created['待办']}", json_body={
            "content": "更新后的待办内容", "tag": "待办"
        })
        assert resp.json().get("content") == "更新后的待办内容"

        # 4. 验证列表
        resp = admin_client.get("/guestbook", query={"page": 1, "limit": 20})
        items = resp.json().get("items", [])
        assert len(items) >= 5

        # 5. 验证置顶排序
        assert items[0].get("pinned") is True
