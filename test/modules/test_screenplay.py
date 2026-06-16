"""编剧功能测试 - 场景/剧集/伏笔/角色弧线"""
import pytest


class TestFilmScreenplay:
    """电影剧本"""

    def test_get_screenplay(self, admin_client, screenplay_project):
        """TC-SCR-01: 获取剧本数据"""
        pid = screenplay_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay")
        assert resp.status_code == 200

    def test_create_scene(self, admin_client, screenplay_project):
        """TC-SCR-02: 创建场景"""
        pid = screenplay_project["id"]
        resp = admin_client.post(f"/projects/{pid}/screenplay/scenes", json_body={
            "location": "咖啡厅", "int_ext": "INT", "time_of_day": "日",
            "act": 1, "synopsis": "主角出场"
        })
        assert resp.status_code == 200
        assert resp.json().get("id")

    def test_list_scenes(self, admin_client, screenplay_project):
        """TC-SCR-03: 列出场景"""
        pid = screenplay_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay")
        assert resp.status_code == 200

    def test_update_scene(self, admin_client, screenplay_project, scene_id):
        """TC-SCR-04: 更新场景"""
        pid, sid = scene_id
        resp = admin_client.patch(f"/projects/{pid}/screenplay/scenes/{sid}", json_body={
            "synopsis": "更新后的梗概"
        })
        assert resp.status_code == 200

    def test_reorder_scenes(self, admin_client, screenplay_project):
        """TC-SCR-05: 重排场景"""
        pid = screenplay_project["id"]
        resp = admin_client.post(f"/projects/{pid}/screenplay/scenes/reorder", json_body={
            "order": []
        })
        assert resp.status_code == 200

    def test_get_screenplay_stats(self, admin_client, screenplay_project):
        """TC-SCR-06: 获取剧本统计"""
        pid = screenplay_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay/stats")
        assert resp.status_code == 200

    def test_get_storylines(self, admin_client, screenplay_project):
        """TC-SCR-07: 获取故事线"""
        pid = screenplay_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay/storylines")
        assert resp.status_code == 200

    def test_get_characters(self, admin_client, screenplay_project):
        """TC-SCR-08: 获取角色统计"""
        pid = screenplay_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay/characters")
        assert resp.status_code == 200

    def test_export_fountain(self, admin_client, screenplay_project):
        """TC-SCR-09: 导出 Fountain 格式"""
        pid = screenplay_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay/export/fountain")
        assert resp.status_code == 200


class TestSeriesScreenplay:
    """剧集剧本"""

    def test_create_episode(self, admin_client, series_project):
        """TC-SCR-10: 创建剧集"""
        pid = series_project["id"]
        resp = admin_client.post(f"/projects/{pid}/screenplay/episodes", json_body={
            "title": "第一集", "number": 1
        })
        assert resp.status_code == 200

    def test_list_episodes(self, admin_client, series_project):
        """TC-SCR-11: 列出剧集"""
        pid = series_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay")
        assert resp.status_code == 200

    def test_create_foreshadow(self, admin_client, series_project):
        """TC-SCR-12: 创建伏笔"""
        pid = series_project["id"]
        resp = admin_client.post(f"/projects/{pid}/screenplay/foreshadows", json_body={
            "description": "神秘老人的玉佩", "planted_episode": 1
        })
        assert resp.status_code == 200

    def test_list_foreshadows(self, admin_client, series_project):
        """TC-SCR-13: 列出伏笔"""
        pid = series_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay/foreshadows")
        assert resp.status_code == 200

    def test_update_character_arc(self, admin_client, series_project):
        """TC-SCR-14: 更新角色弧线"""
        pid = series_project["id"]
        resp = admin_client.patch(
            f"/projects/{pid}/screenplay/character-arcs/主角",
            json_body={"arc": "从懦弱到勇敢"}
        )
        assert resp.status_code == 200

    def test_get_character_arcs(self, admin_client, series_project):
        """TC-SCR-15: 获取角色弧线"""
        pid = series_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay/character-arcs")
        assert resp.status_code == 200


class TestWebShort:
    """短视频脚本"""

    def test_create_shot(self, admin_client, web_short_project):
        """TC-SCR-16: 创建分镜"""
        pid = web_short_project["id"]
        resp = admin_client.post(f"/projects/{pid}/screenplay/shots", json_body={
            "description": "开场镜头", "duration": 3
        })
        assert resp.status_code == 200

    def test_list_shots(self, admin_client, web_short_project):
        """TC-SCR-17: 列出分镜"""
        pid = web_short_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay")
        assert resp.status_code == 200

    def test_set_platform(self, admin_client, web_short_project):
        """TC-SCR-18: 设置平台"""
        pid = web_short_project["id"]
        resp = admin_client.put(f"/projects/{pid}/screenplay/platform", json_body={
            "platform": "抖音", "target_duration": 60
        })
        assert resp.status_code == 200

    def test_get_rhythm(self, admin_client, web_short_project):
        """TC-SCR-19: 获取节奏分析"""
        pid = web_short_project["id"]
        resp = admin_client.get(f"/projects/{pid}/screenplay/rhythm")
        assert resp.status_code == 200
