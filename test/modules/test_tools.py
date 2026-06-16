"""工具和技能测试 - 覆盖 /tools 和 /mcp 端点"""
import pytest


class TestTools:
    """工具管理"""

    def test_get_tools_overview(self, admin_client):
        """TC-TOOL-01: 获取工具概览"""
        resp = admin_client.get("/tools/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert "installed_skills_count" in data

    def test_list_skills(self, admin_client):
        """TC-TOOL-02: 列出已安装技能"""
        resp = admin_client.get("/tools/skills")
        assert resp.status_code == 200

    def test_search_skills(self, admin_client):
        """TC-TOOL-03: 搜索技能目录"""
        resp = admin_client.get("/tools/skills/search", query={"q": "webnovel"})
        assert resp.status_code == 200

    def test_get_default_skill(self, admin_client):
        """TC-TOOL-04: 获取默认技能能力（未配置时返回 404）"""
        resp = admin_client.get("/tools/skills/capabilities/default")
        # 未配置默认 Skill 时返回 404 是正确行为
        assert resp.status_code in (200, 404)


class TestMCP:
    """MCP 扩展"""

    def test_get_mcp_overview(self, admin_client):
        """TC-MCP-01: 获取 MCP 概览"""
        resp = admin_client.get("/mcp/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert "sources" in data

    def test_list_mcp_servers(self, admin_client):
        """TC-MCP-02: 列出 MCP 服务器"""
        resp = admin_client.get("/mcp/servers")
        assert resp.status_code == 200

    def test_get_studio_mcp(self, admin_client):
        """TC-MCP-03: 获取 Studio MCP 配置"""
        resp = admin_client.get("/mcp/studio")
        assert resp.status_code == 200

    def test_mcp_registry_search(self, admin_client):
        """TC-MCP-04: 搜索 MCP 注册表"""
        resp = admin_client.get("/mcp/registry/search", query={"q": "filesystem"})
        assert resp.status_code == 200

    def test_mcp_health(self, admin_client):
        """TC-MCP-05: MCP 健康检查"""
        resp = admin_client.post("/mcp/health")
        assert resp.status_code == 200
