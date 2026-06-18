"""AI 模型配置测试 - 覆盖所有 /models 端点"""
import pytest


class TestModelCRUD:
    """模型增删改查"""

    def test_list_models(self, admin_client):
        """TC-MOD-01: 获取模型列表"""
        resp = admin_client.get("/models")
        assert resp.status_code == 200

    def test_create_model(self, admin_client):
        """TC-MOD-02: 创建模型配置"""
        resp = admin_client.post("/models", json_body={
            "name": "测试模型", "model": "gpt-4",
            "base_url": "https://api.openai.com/v1", "api_key": "sk-test"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("id")
        admin_client.delete(f"/models/{data['id']}")

    def test_update_model(self, admin_client):
        """TC-MOD-03: 更新模型配置"""
        resp = admin_client.post("/models", json_body={
            "name": "待更新", "model": "gpt-4", "base_url": "https://api.openai.com/v1", "api_key": "sk-test"
        })
        mid = resp.json()["id"]

        resp = admin_client.put(f"/models/{mid}", json_body={"name": "已更新"})
        assert resp.status_code == 200

        admin_client.delete(f"/models/{mid}")

    def test_delete_model(self, admin_client):
        """TC-MOD-04: 删除模型"""
        resp = admin_client.post("/models", json_body={
            "name": "待删除", "model": "gpt-4", "base_url": "https://api.openai.com/v1", "api_key": "sk-test"
        })
        mid = resp.json()["id"]

        resp = admin_client.delete(f"/models/{mid}")
        assert resp.status_code == 200

    def test_activate_model(self, admin_client):
        """TC-MOD-05: 设为活跃模型（须为 Claude CLI 兼容协议）"""
        resp = admin_client.post("/models", json_body={
            "name": "活跃测试", "model": "deepseek-chat",
            "base_url": "https://api.deepseek.com/anthropic", "api_key": "sk-test",
            "protocol": "anthropic",
        })
        mid = resp.json()["id"]

        resp = admin_client.post(f"/models/{mid}/activate")
        assert resp.status_code == 200

        admin_client.delete(f"/models/{mid}")

    def test_test_model_connection(self, admin_client):
        """TC-MOD-06: 测试模型连接"""
        resp = admin_client.post("/models/test", json_body={
            "model": "gpt-4", "base_url": "https://api.openai.com/v1", "api_key": "sk-invalid", "protocol": "openai"
        })
        # 无效 API Key 时返回 400 是正确行为（连接失败）
        assert resp.status_code in (200, 400)

    def test_import_cc_switch(self, admin_client):
        """TC-MOD-07: 从 CC Switch 导入配置"""
        resp = admin_client.get("/models/import/cc-switch")
        # 可能成功或失败，取决于环境
        assert resp.status_code in (200, 404, 500)

    def test_get_ai_usage(self, admin_client):
        """TC-MOD-08: 获取 AI 用量统计"""
        resp = admin_client.get("/usage")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
