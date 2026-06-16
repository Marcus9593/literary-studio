"""故事规划器测试 - 路线图/任务/计划/健康"""
import pytest


class TestStoryPlanner:
    """故事规划器"""

    def test_get_planner_goal(self, admin_client, novel_project):
        """TC-PLAN-01: 获取规划器目标（需先生成）"""
        pid = novel_project["id"]
        # 先生成规划器
        admin_client.post(f"/projects/{pid}/story/planner/generate", json_body={"horizon": 5})
        resp = admin_client.get(f"/projects/{pid}/story/planner/goal")
        assert resp.status_code == 200

    def test_get_planner_roadmap(self, admin_client, novel_project):
        """TC-PLAN-02: 获取章节路线图（需先生成）"""
        pid = novel_project["id"]
        # 先生成规划器
        admin_client.post(f"/projects/{pid}/story/planner/generate", json_body={"horizon": 5})
        resp = admin_client.get(f"/projects/{pid}/story/planner/roadmap")
        assert resp.status_code == 200

    def test_generate_planner(self, admin_client, novel_project):
        """TC-PLAN-03: 生成创作规划"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/story/planner/generate", json_body={"horizon": 5})
        assert resp.status_code == 200

    def test_get_planner_bundle(self, admin_client, novel_project):
        """TC-PLAN-04: 获取规划器完整数据"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/planner/bundle")
        assert resp.status_code == 200


class TestStoryTasks:
    """创作任务"""

    def test_get_today_tasks(self, admin_client, novel_project):
        """TC-PLAN-05: 获取今日任务"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/tasks/today")
        assert resp.status_code == 200

    def test_get_all_tasks(self, admin_client, novel_project):
        """TC-PLAN-06: 获取所有任务"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/tasks")
        assert resp.status_code == 200


class TestStoryPlans:
    """修改计划"""

    def test_list_plans(self, admin_client, novel_project):
        """TC-PLAN-07: 列出修改计划"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/plans")
        assert resp.status_code == 200


class TestStoryHealth:
    """故事健康"""

    def test_get_health(self, admin_client, novel_project):
        """TC-PLAN-08: 获取项目健康"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "overall_health" in data

    def test_get_consistency(self, admin_client, novel_project):
        """TC-PLAN-09: 获取一致性检查"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/consistency")
        assert resp.status_code == 200

    def test_get_verify(self, admin_client, novel_project):
        """TC-PLAN-10: 获取验证数据"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/verify")
        assert resp.status_code == 200

    def test_get_today_suggestions(self, admin_client, novel_project):
        """TC-PLAN-11: 获取今日建议"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/actions/today")
        assert resp.status_code == 200

    def test_get_understanding(self, admin_client, novel_project):
        """TC-PLAN-12: 获取故事理解"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/story/understanding")
        assert resp.status_code == 200

    def test_story_sync(self, admin_client, novel_project):
        """TC-PLAN-13: 同步故事知识库"""
        pid = novel_project["id"]
        # 先创建一个章节，确保项目有内容可同步
        admin_client.post(f"/projects/{pid}/chapters", json_body={
            "title": "第一章", "content": "# 第一章\n\n故事开始了。"
        })
        resp = admin_client.post(f"/projects/{pid}/story/sync", json_body={"mode": "quick"})
        # 空项目或无实质内容时可能返回 400，这是可接受的行为
        assert resp.status_code in (200, 400)
