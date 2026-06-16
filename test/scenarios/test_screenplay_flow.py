"""场景测试：编剧项目流程"""
import pytest
from conftest import unique_title


class TestScreenplayFlow:
    """编剧流程：创建剧本 → 加场景 → 设Canon → 查统计"""

    def test_film_screenplay_flow(self, admin_client):
        """SC-SCR-01: 电影剧本完整流程"""
        # 1. 创建电影剧本
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("film"), "work_type": "screenplay_film", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        # 2. 添加 Canon 规则
        resp = admin_client.post(f"/projects/{pid}/engine/canon", json_body={
            "title": "世界观", "content": "现代都市，有超能力者存在", "immutability": "immutable"
        })
        assert resp.status_code == 200

        # 3. 设置圣经
        resp = admin_client.put(f"/projects/{pid}/engine/bible", json_body={
            "title": "测试剧本", "genre": "悬疑", "logline": "一个警察追查连环杀手"
        })
        assert resp.status_code == 200

        # 4. 创建场景
        for i, (loc, act) in enumerate([("警局", 1), ("案发现场", 1), ("审讯室", 2)]):
            resp = admin_client.post(f"/projects/{pid}/screenplay/scenes", json_body={
                "location": loc, "int_ext": "INT", "time_of_day": "日", "act": act
            })
            assert resp.status_code == 200

        # 5. 获取统计
        resp = admin_client.get(f"/projects/{pid}/screenplay/stats")
        assert resp.status_code == 200

        # 6. 导出 Fountain
        resp = admin_client.get(f"/projects/{pid}/screenplay/export/fountain")
        assert resp.status_code == 200

        admin_client.delete(f"/projects/{pid}")

    def test_series_screenplay_flow(self, admin_client):
        """SC-SCR-02: 剧集剧本完整流程"""
        # 1. 创建剧集
        resp = admin_client.post("/projects", json_body={
            "title": unique_title("series"), "work_type": "screenplay_series", "creation_mode": "scratch"
        })
        pid = resp.json()["id"]

        # 2. 创建剧集
        for i in range(1, 4):
            resp = admin_client.post(f"/projects/{pid}/screenplay/episodes", json_body={
                "title": f"第{i}集", "number": i
            })
            assert resp.status_code == 200

        # 3. 添加伏笔
        resp = admin_client.post(f"/projects/{pid}/screenplay/foreshadows", json_body={
            "description": "神秘老人的玉佩", "planted_episode": 1
        })
        assert resp.status_code == 200

        # 4. 更新角色弧线
        resp = admin_client.patch(
            f"/projects/{pid}/screenplay/character-arcs/主角",
            json_body={"arc": "从懦弱到勇敢"}
        )
        assert resp.status_code == 200

        # 5. 获取伏笔列表
        resp = admin_client.get(f"/projects/{pid}/screenplay/foreshadows")
        assert resp.status_code == 200

        admin_client.delete(f"/projects/{pid}")
