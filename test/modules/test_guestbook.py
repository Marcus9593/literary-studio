"""创作日志模块测试 - 覆盖所有 /guestbook 端点"""
import pytest
from conftest import unique_title


class TestGuestbookCRUD:
    """创作日志增删改查"""

    def test_create_entry(self, admin_client):
        """TC-JNL-01: 创建带标签的日志"""
        resp = admin_client.post("/guestbook", json_body={
            "content": "测试灵感：主角师父是反派", "tag": "灵感"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data.get("tag") == "灵感"
        assert data.get("content") == "测试灵感：主角师父是反派"

    def test_create_all_tags(self, admin_client):
        """TC-JNL-02: 创建所有标签类型"""
        for tag in ["灵感", "待办", "进度", "反馈", "其他"]:
            resp = admin_client.post("/guestbook", json_body={"content": f"测试{tag}", "tag": tag})
            assert resp.status_code == 201
            assert resp.json().get("tag") == tag

    def test_list_entries(self, admin_client):
        """TC-JNL-03: 列出日志"""
        resp = admin_client.get("/guestbook", query={"page": 1, "limit": 20})
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert len(data["items"]) > 0

    def test_pin_entry(self, admin_client):
        """TC-JNL-04: 置顶日志"""
        # 创建
        resp = admin_client.post("/guestbook", json_body={"content": "待置顶", "tag": "其他"})
        assert resp.status_code == 201
        jid = resp.json()["id"]

        # 置顶
        resp = admin_client.patch(f"/guestbook/{jid}", json_body={"pinned": True})
        assert resp.status_code == 200
        assert resp.json().get("pinned") is True

    def test_unpin_entry(self, admin_client):
        """TC-JNL-05: 取消置顶"""
        resp = admin_client.post("/guestbook", json_body={"content": "置顶后取消", "tag": "其他"})
        assert resp.status_code == 201
        jid = resp.json()["id"]

        admin_client.patch(f"/guestbook/{jid}", json_body={"pinned": True})
        resp = admin_client.patch(f"/guestbook/{jid}", json_body={"pinned": False})
        assert resp.json().get("pinned") is False

    def test_edit_content(self, admin_client):
        """TC-JNL-06: 编辑日志内容"""
        resp = admin_client.post("/guestbook", json_body={"content": "原始内容", "tag": "灵感"})
        assert resp.status_code == 201
        jid = resp.json()["id"]

        resp = admin_client.patch(f"/guestbook/{jid}", json_body={"content": "修改后的内容"})
        assert resp.status_code == 200
        assert resp.json().get("content") == "修改后的内容"

    def test_edit_tag(self, admin_client):
        """TC-JNL-07: 修改日志标签"""
        resp = admin_client.post("/guestbook", json_body={"content": "改标签", "tag": "灵感"})
        assert resp.status_code == 201
        jid = resp.json()["id"]

        resp = admin_client.patch(f"/guestbook/{jid}", json_body={"tag": "进度"})
        assert resp.json().get("tag") == "进度"

    def test_delete_entry(self, admin_client):
        """TC-JNL-08: 删除日志"""
        resp = admin_client.post("/guestbook", json_body={"content": "待删除", "tag": "其他"})
        assert resp.status_code == 201
        jid = resp.json()["id"]

        resp = admin_client.delete(f"/guestbook/{jid}")
        assert resp.status_code == 200
        assert resp.json().get("status") == "deleted"

    def test_pinned_sorts_first(self, admin_client):
        """TC-JNL-09: 置顶日志排在最前面"""
        # 创建两条
        resp1 = admin_client.post("/guestbook", json_body={"content": "普通条目", "tag": "其他"})
        resp2 = admin_client.post("/guestbook", json_body={"content": "置顶条目", "tag": "灵感"})
        assert resp1.status_code == 201
        assert resp2.status_code == 201
        jid2 = resp2.json()["id"]

        # 置顶第二条
        admin_client.patch(f"/guestbook/{jid2}", json_body={"pinned": True})

        # 列表
        resp = admin_client.get("/guestbook", query={"page": 1, "limit": 5})
        items = resp.json().get("items", [])
        if len(items) >= 2:
            assert items[0].get("pinned") is True
