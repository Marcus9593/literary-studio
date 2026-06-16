"""场景测试：版本回滚流程"""
import pytest
from urllib.parse import quote
from conftest import unique_title


class TestVersionRollback:
    """版本回滚：写 → 快照 → 改 → 回滚 → 验证"""

    def test_rollback_flow(self, admin_client):
        """SC-VER-01: 完整版本回滚流程"""
        # 1. 创建项目和章节
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("rollback"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        resp = admin_client.post(f"/projects/{pid}/manuscripts", json_body={
            "title": "第一章", "content": "# 第一章\n\n原始内容，非常重要。"
        })
        fn = resp.json()["filename"]
        encoded_fn = quote(fn, safe="")

        # 2. 记录原始内容
        resp = admin_client.get(f"/projects/{pid}/chapters/{encoded_fn}")
        original_content = resp.json().get("content", "")
        original_length = len(original_content)

        # 3. 创建快照
        resp = admin_client.post(f"/projects/{pid}/versions/create", json_body={
            "title": "改写前备份"
        })
        vid = resp.json()["id"]

        # 4. 修改内容
        admin_client.put(f"/projects/{pid}/chapters/{encoded_fn}", json_body={
            "content": "# 第一章\n\n完全不同的内容，测试回滚用。"
        })

        # 5. 验证内容已改变
        resp = admin_client.get(f"/projects/{pid}/chapters/{encoded_fn}")
        changed_content = resp.json().get("content", "")
        assert "完全不同的内容" in changed_content

        # 6. 回滚
        resp = admin_client.post(f"/projects/{pid}/versions/{vid}/restore")
        assert resp.status_code == 200

        # 7. 验证回滚成功
        resp = admin_client.get(f"/projects/{pid}/chapters/{encoded_fn}")
        restored_content = resp.json().get("content", "")
        assert original_length == len(restored_content)

        admin_client.delete(f"/projects/{pid}")


class TestMultiVersion:
    """多版本管理"""

    def test_multiple_snapshots(self, admin_client):
        """SC-VER-02: 多版本快照管理"""
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("multiver"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        # 创建多个快照
        for i in range(3):
            resp = admin_client.post(f"/projects/{pid}/versions/create", json_body={
                "title": f"版本 {i+1}"
            })
            assert resp.status_code == 200

        # 列出版本
        resp = admin_client.get(f"/projects/{pid}/versions")
        assert resp.status_code == 200
        versions = resp.json() if isinstance(resp.json(), list) else resp.json().get("versions", [])
        assert len(versions) >= 3

        admin_client.delete(f"/projects/{pid}")
