"""故事引擎测试 - Canon/圣经/节拍/记忆/分析"""
import pytest


class TestCanonRules:
    """Canon 规则"""

    def test_list_canon(self, admin_client, novel_project):
        """TC-ENG-01: 列出 Canon 规则"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/canon")
        assert resp.status_code == 200

    def test_create_canon(self, admin_client, novel_project):
        """TC-ENG-02: 创建 Canon 规则"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/engine/canon", json_body={
            "title": "魔法规则", "content": "魔法消耗寿命", "immutability": "immutable"
        })
        assert resp.status_code == 200
        assert resp.json().get("id")

    def test_get_canon_context(self, admin_client, novel_project):
        """TC-ENG-03: 获取 Canon 上下文"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/canon/context")
        assert resp.status_code == 200

    def test_validate_against_canon(self, admin_client, novel_project):
        """TC-ENG-04: 验证内容是否符合 Canon"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/engine/canon/validate", json_body={
            "content": "主角使用魔法攻击敌人"
        })
        assert resp.status_code == 200


class TestStoryBible:
    """设定圣经"""

    def test_get_bible(self, admin_client, novel_project):
        """TC-ENG-05: 获取设定圣经"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/bible")
        assert resp.status_code == 200

    def test_save_bible(self, admin_client, novel_project):
        """TC-ENG-06: 保存设定圣经"""
        pid = novel_project["id"]
        resp = admin_client.put(f"/projects/{pid}/engine/bible", json_body={
            "title": "测试小说", "genre": "玄幻", "logline": "少年修炼", "setting": "架空世界"
        })
        assert resp.status_code == 200

    def test_upsert_bible_section(self, admin_client, novel_project):
        """TC-ENG-07: 添加圣经分区"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/engine/bible/sections", json_body={
            "type": "magic", "title": "魔法体系", "content": "火系、水系、风系"
        })
        assert resp.status_code == 200


class TestBeatOutline:
    """节拍大纲"""

    def test_get_beats(self, admin_client, novel_project):
        """TC-ENG-08: 获取节拍大纲"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/beats", query={"unit_index": 1})
        assert resp.status_code == 200

    def test_save_beats(self, admin_client, novel_project):
        """TC-ENG-09: 保存节拍大纲"""
        pid = novel_project["id"]
        resp = admin_client.put(f"/projects/{pid}/engine/beats/1", json_body={
            "title": "第一章", "beats": [
                {"title": "开场", "scene_type": "action", "description": "主角登场"},
                {"title": "冲突", "scene_type": "dialogue", "description": "遇到反派"},
            ]
        })
        assert resp.status_code == 200


class TestStructuredMemory:
    """结构化记忆"""

    def test_get_memory_facts(self, admin_client, novel_project):
        """TC-ENG-10: 获取记忆事实"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/memory/facts")
        assert resp.status_code == 200

    def test_get_memory_summaries(self, admin_client, novel_project):
        """TC-ENG-11: 获取记忆摘要"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/memory/summaries")
        assert resp.status_code == 200


class TestNarrativeAnalysis:
    """叙事分析"""

    def test_run_analysis(self, admin_client, novel_project):
        """TC-ENG-12: 运行叙事分析"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/analysis")
        assert resp.status_code == 200

    def test_get_character_graph(self, admin_client, novel_project):
        """TC-ENG-13: 获取角色关系图"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/character-graph")
        assert resp.status_code == 200


class TestVoiceDna:
    """声纹 DNA"""

    def test_list_voice_dna(self, admin_client, novel_project):
        """TC-ENG-14: 列出声纹 DNA"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/voice-dna")
        assert resp.status_code == 200


class TestCritic:
    """审查引擎"""

    def test_get_latest_critic(self, admin_client, novel_project):
        """TC-ENG-15: 获取最新审查结果"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/critic/latest")
        assert resp.status_code == 200

    def test_list_critic_reports(self, admin_client, novel_project):
        """TC-ENG-16: 列出审查报告"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/critic-reports")
        assert resp.status_code == 200

    def test_list_pipelines(self, admin_client, novel_project):
        """TC-ENG-17: 列出流水线记录"""
        pid = novel_project["id"]
        resp = admin_client.get(f"/projects/{pid}/engine/pipelines")
        assert resp.status_code == 200

    def test_export_content(self, admin_client, novel_project):
        """TC-ENG-18: 导出内容"""
        pid = novel_project["id"]
        resp = admin_client.post(f"/projects/{pid}/engine/export", json_body={"format": "md"})
        assert resp.status_code == 200
