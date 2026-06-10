"""Story OS & Story Engine API tests."""
from __future__ import annotations

from config import FAKE_PLAN_ID, FAKE_RULE_ID, FAKE_TASK_ID


class TestStoryOS:
    def test_knowledge_get_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/knowledge")
        assert resp.status_code == 200

    def test_knowledge_put_positive(self, admin_client, novel_project):
        resp = admin_client.put(
            f"/projects/{novel_project['id']}/story/knowledge",
            json_body={"story_summary": {"logline": "pytest summary", "themes": []}},
        )
        assert resp.status_code in (200, 400)

    def test_knowledge_rebuild_positive(self, admin_client, novel_project):
        resp = admin_client.post(f"/projects/{novel_project['id']}/story/knowledge/rebuild")
        assert resp.status_code in (200, 400)

    def test_summaries_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/summaries")
        assert resp.status_code == 200

    def test_index_query_positive(self, admin_client, novel_project):
        resp = admin_client.get(
            f"/projects/{novel_project['id']}/story/index/query",
            query={"q": "测试"},
        )
        assert resp.status_code == 200

    def test_plans_list_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/plans")
        assert resp.status_code == 200

    def test_plan_get_negative_not_found(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/plans/{FAKE_PLAN_ID}")
        assert resp.status_code == 404

    def test_health_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/health")
        assert resp.status_code == 200

    def test_consistency_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/consistency")
        assert resp.status_code == 200

    def test_verify_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/verify")
        assert resp.status_code == 200

    def test_understanding_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/understanding")
        assert resp.status_code == 200

    def test_actions_today_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/actions/today")
        assert resp.status_code == 200

    def test_sync_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/story/sync",
            json_body={"mode": "quick"},
        )
        assert resp.status_code in (200, 400)

    def test_planner_bundle_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/planner/bundle")
        assert resp.status_code == 200

    def test_planner_preferences_roundtrip(self, admin_client, novel_project):
        pid = novel_project["id"]
        put = admin_client.put(
            f"/projects/{pid}/story/planner/preferences",
            json_body={"daily_word_goal": 3000},
        )
        assert put.status_code == 200
        get = admin_client.get(f"/projects/{pid}/story/planner/preferences")
        assert get.status_code == 200

    def test_tasks_today_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/story/tasks/today")
        assert resp.status_code == 200

    def test_task_plan_negative_not_found(self, admin_client, novel_project):
        resp = admin_client.post(f"/projects/{novel_project['id']}/story/tasks/{FAKE_TASK_ID}/plan")
        assert resp.status_code in (400, 404, 500)


class TestStoryEngine:
    def test_canon_list_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/engine/canon")
        assert resp.status_code == 200

    def test_canon_create_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/engine/canon",
            json_body={"category": "character", "rule": "主角不能死", "severity": "hard"},
        )
        assert resp.status_code == 200
        assert "id" in resp.json()

    def test_canon_get_positive(self, admin_client, novel_project):
        pid = novel_project["id"]
        created = admin_client.post(
            f"/projects/{pid}/engine/canon",
            json_body={"category": "world", "rule": "pytest get rule", "severity": "hard"},
        )
        assert created.status_code == 200
        rule_id = created.json()["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/canon/{rule_id}")
        assert resp.status_code == 200

    def test_canon_get_negative_not_found(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/engine/canon/{FAKE_RULE_ID}")
        assert resp.status_code == 404

    def test_canon_validate_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/engine/canon/validate",
            json_body={"content": "测试正文", "unit_index": 1},
        )
        assert resp.status_code == 200

    def test_pipelines_list_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/engine/pipelines")
        assert resp.status_code == 200

    def test_critic_reports_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/engine/critic-reports")
        assert resp.status_code == 200

    def test_memory_facts_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/engine/memory/facts")
        assert resp.status_code == 200

    def test_memory_facts_post_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/engine/memory/facts",
            json_body={"fact": "pytest fact", "category": "event", "unit_index": 1},
        )
        assert resp.status_code == 200

    def test_bible_roundtrip(self, admin_client, novel_project):
        pid = novel_project["id"]
        put = admin_client.put(
            f"/projects/{pid}/engine/bible",
            json_body={"sections": [{"id": "s1", "title": "世界观", "content": "测试"}]},
        )
        assert put.status_code == 200
        get = admin_client.get(f"/projects/{pid}/engine/bible")
        assert get.status_code == 200

    def test_beats_put_positive(self, admin_client, novel_project):
        resp = admin_client.put(
            f"/projects/{novel_project['id']}/engine/beats/1",
            json_body={"beats": [{"title": "开场", "description": "介绍主角"}]},
        )
        assert resp.status_code == 200

    def test_character_graph_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/engine/character-graph")
        assert resp.status_code == 200

    def test_analysis_get_positive(self, admin_client, novel_project):
        resp = admin_client.get(f"/projects/{novel_project['id']}/engine/analysis")
        assert resp.status_code == 200

    def test_self_review_extract_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/engine/self-review/extract",
            json_body={"output": "我认为这段节奏偏慢。"},
        )
        assert resp.status_code == 200

    def test_engine_export_positive(self, admin_client, novel_project):
        resp = admin_client.post(
            f"/projects/{novel_project['id']}/engine/export",
            json_body={"format": "md", "download": False},
        )
        assert resp.status_code == 200
