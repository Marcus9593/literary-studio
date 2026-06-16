"""场景测试：审稿流水线"""
import pytest
from conftest import unique_title


class TestReviewPipeline:
    """审稿流程：写章节 → 规则审查 → 语义审查 → 修改计划"""

    def test_review_flow(self, admin_client):
        """SC-REV-01: 审稿流水线"""
        # 1. 创建项目和章节
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("review"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        admin_client.post(f"/projects/{pid}/manuscripts", json_body={
            "title": "第一章", "content": "# 第一章\n\n林风站在山巅。他决定去冒险。"
        })

        # 2. 获取项目健康
        resp = admin_client.get(f"/projects/{pid}/story/health")
        assert resp.status_code == 200

        # 3. 获取一致性检查
        resp = admin_client.get(f"/projects/{pid}/story/consistency")
        assert resp.status_code == 200

        # 4. 获取引擎最新审查
        resp = admin_client.get(f"/projects/{pid}/engine/critic/latest")
        assert resp.status_code == 200

        # 5. 获取审查报告列表
        resp = admin_client.get(f"/projects/{pid}/engine/critic-reports")
        assert resp.status_code == 200

        # 6. 获取修改计划列表
        resp = admin_client.get(f"/projects/{pid}/story/plans")
        assert resp.status_code == 200

        admin_client.delete(f"/projects/{pid}")


class TestEnginePipeline:
    """引擎流水线：Canon → 圣经 → 节拍 → 审查"""

    def test_engine_flow(self, admin_client):
        """SC-REV-02: 编剧引擎完整流程"""
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("engine"), "work_type": "novel_long", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        # 1. Canon 规则
        admin_client.post(f"/projects/{pid}/engine/canon", json_body={
            "title": "魔法规则", "content": "魔法消耗寿命", "immutability": "immutable"
        })

        # 2. 设定圣经
        admin_client.put(f"/projects/{pid}/engine/bible", json_body={
            "title": "测试", "genre": "玄幻"
        })

        # 3. 节拍大纲
        admin_client.put(f"/projects/{pid}/engine/beats/1", json_body={
            "title": "第一章", "beats": [
                {"title": "开场", "scene_type": "action", "description": "主角登场"}
            ]
        })

        # 4. 获取 Canon 上下文
        resp = admin_client.get(f"/projects/{pid}/engine/canon/context")
        assert resp.status_code == 200

        # 5. 验证内容
        resp = admin_client.post(f"/projects/{pid}/engine/canon/validate", json_body={
            "content": "主角使用魔法攻击"
        })
        assert resp.status_code == 200

        # 6. 获取记忆事实
        resp = admin_client.get(f"/projects/{pid}/engine/memory/facts")
        assert resp.status_code == 200

        admin_client.delete(f"/projects/{pid}")
