"""场景测试：完整创作流程 - 从创建项目到导出"""
import pytest
from helpers.client import ApiClient
from conftest import unique_title


class TestFullCreationFlow:
    """完整创作流程：创建项目 → 写章节 → 建快照 → 查健康 → 导出"""

    def test_full_flow(self, admin_client):
        """SC-FLOW-01: 完整创作流程"""
        # 1. 创建项目
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("flow"), "work_type": "novel_long", "creation_mode": "scratch", "genre": "玄幻"
        })
        assert resp.status_code == 200
        pid = resp.json()["id"]

        # 2. 创建大纲文件
        resp = admin_client.put(f"/projects/{pid}/files/outline/总纲.md", json_body={
            "content": "# 总纲\n\n## 故事简介\n少年修炼的故事。\n\n## 主角\n林风，18岁，孤儿。"
        })
        assert resp.status_code == 200

        # 3. 创建设定文件
        resp = admin_client.put(f"/projects/{pid}/files/settings/角色设定.md", json_body={
            "content": "# 角色设定\n\n## 林风\n- 主角\n- 18岁\n- 孤儿"
        })
        assert resp.status_code == 200

        # 4. 写第一章
        resp = admin_client.post(f"/projects/{pid}/manuscripts", json_body={
            "title": "第一章 初入江湖",
            "content": "# 第一章\n\n林风站在山巅，望着远方的城市。\n\n风很大，他的衣角猎猎作响。"
        })
        assert resp.status_code == 200
        fn = resp.json()["filename"]

        # 5. 更新知识库
        resp = admin_client.put(f"/projects/{pid}/story/knowledge", json_body={
            "characters": {"items": [{"name": "林风", "role": "主角", "notes": "18岁孤儿"}]}
        })
        assert resp.status_code == 200

        # 6. 创建版本快照
        resp = admin_client.post(f"/projects/{pid}/versions/create", json_body={
            "title": "第一章完成"
        })
        assert resp.status_code == 200

        # 7. 查看项目健康
        resp = admin_client.get(f"/projects/{pid}/story/health")
        assert resp.status_code == 200

        # 8. 写第二章
        resp = admin_client.post(f"/projects/{pid}/manuscripts", json_body={
            "title": "第二章 拜入宗门",
            "content": "# 第二章\n\n林风来到了青云宗门前。"
        })
        assert resp.status_code == 200

        # 9. 查看章节列表
        resp = admin_client.get(f"/projects/{pid}/chapters")
        assert resp.status_code == 200
        chapters = resp.json() if isinstance(resp.json(), list) else resp.json().get("chapters", [])
        assert len(chapters) >= 2

        # 10. 获取导出格式
        resp = admin_client.get("/export/formats")
        assert resp.status_code == 200

        # 清理
        admin_client.delete(f"/projects/{pid}")


class TestSettingConsistency:
    """设定一致性流程：写设定 → 写章节 → 检查一致性"""

    def test_consistency_check(self, admin_client):
        """SC-FLOW-02: 设定一致性检查"""
        # 1. 创建项目
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("consist"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        # 2. 写设定
        admin_client.put(f"/projects/{pid}/files/settings/力量体系.md", json_body={
            "content": "# 力量体系\n\n## 等级\n炼气 → 筑基 → 金丹 → 元婴\n\n## 规则\n魔法消耗寿命"
        })

        # 3. 写章节
        admin_client.post(f"/projects/{pid}/manuscripts", json_body={
            "title": "第一章", "content": "# 第一章\n\n林风刚刚突破到筑基期。"
        })

        # 4. 检查一致性
        resp = admin_client.get(f"/projects/{pid}/story/consistency")
        assert resp.status_code == 200

        # 5. 重建知识库
        resp = admin_client.post(f"/projects/{pid}/story/knowledge/rebuild")
        assert resp.status_code == 200

        admin_client.delete(f"/projects/{pid}")
