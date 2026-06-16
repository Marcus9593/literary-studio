import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../../../components/StatusBadge.jsx'
import {
  getAiUsage,
  getHealth,
  getToolsOverview,
  listModels,
} from '../../../api.js'

export default function AiOverviewPanel() {
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState(null)
  const [overview, setOverview] = useState(null)
  const [models, setModels] = useState({ active_id: '', models: [] })
  const [usage, setUsage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [h, o, m, u] = await Promise.allSettled([
        getHealth(),
        getToolsOverview(),
        listModels(),
        getAiUsage(),
      ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : null)))
      setHealth(h)
      setOverview(o)
      setModels(m || { active_id: '', models: [] })
      setUsage(u)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="empty-state">
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
        <p style={{ marginTop: 16, color: 'var(--ink-faint)' }}>加载引擎状态…</p>
      </div>
    )
  }

  const activeModel = models.models?.find((m) => m.id === models.active_id)
  const studioModel = health?.inference?.credentials === 'studio_settings'
  const cliOk = health?.claude_code?.available
  const credOk = !studioModel || health?.api_model?.available !== false
  const defaultSkill = overview?.default_skill
  const lw = overview?.literary_writer || {}
  const skillCount = overview?.installed_skills_count ?? 0
  const mcp = overview?.mcp
  const issues = []

  if (!cliOk) issues.push({ text: 'Claude Code 未连接', to: '/ai/models' })
  if (!credOk && models.models?.length) issues.push({ text: '模型凭据不可用', to: '/ai/models' })
  if (!defaultSkill?.valid) issues.push({ text: '未设置默认 Skill', to: '/ai/skills' })
  if (!lw.webnovel_cli) issues.push({ text: '写章 webnovel 脚本未找到', to: '/ai/skills' })

  return (
    <section className="ai-overview">
      <div className="ai-overview-grid">
        <article className="card ai-overview-card">
          <h3>推理引擎</h3>
          <div className="ai-overview-status">
            {cliOk ? (
              <StatusBadge variant="ok" dot>Claude Code 已连接</StatusBadge>
            ) : (
              <StatusBadge variant="warn" dot>Claude Code 未连接</StatusBadge>
            )}
          </div>
          {activeModel ? (
            <p className="ai-overview-detail">
              当前模型：<strong>{activeModel.name}</strong>
              <span className="muted">（{activeModel.model}）</span>
            </p>
          ) : (
            <p className="muted">尚未配置备用模型</p>
          )}
          <Link to="/ai/models" className="btn btn-secondary btn-sm ai-overview-cta">
            配置模型
          </Link>
        </article>

        <article className="card ai-overview-card">
          <h3>默认技能</h3>
          <div className="ai-overview-status">
            {defaultSkill?.valid ? (
              <StatusBadge variant="ok" dot>{defaultSkill.label}</StatusBadge>
            ) : (
              <StatusBadge variant="neutral">自动路由</StatusBadge>
            )}
          </div>
          <p className="ai-overview-detail muted">
            {defaultSkill?.valid
              ? '对话将按此 Skill 工作'
              : 'Claude 将根据对话自动选择 Skill'}
          </p>
          <Link to="/ai/skills" className="btn btn-secondary btn-sm ai-overview-cta">
            配置技能
          </Link>
        </article>

        <article className="card ai-overview-card">
          <h3>本机技能</h3>
          <p className="ai-overview-metric">{skillCount}</p>
          <p className="muted">已扫描安装</p>
          {lw.webnovel_cli ? (
            <StatusBadge variant="ok">写章脚本可用</StatusBadge>
          ) : (
            <StatusBadge variant="warn">写章脚本未就绪</StatusBadge>
          )}
          <Link to="/ai/skills" className="btn btn-secondary btn-sm ai-overview-cta">
            浏览技能
          </Link>
        </article>

        <article className="card ai-overview-card">
          <h3>MCP 扩展</h3>
          <p className="ai-overview-metric">{mcp?.enabled_count ?? 0}</p>
          <p className="muted">已启用 / 共 {mcp?.total_count ?? 0} 个</p>
          {mcp?.cli_injection ? (
            <StatusBadge variant="ok">对话已注入</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">未注入</StatusBadge>
          )}
          <Link to="/ai/mcp" className="btn btn-secondary btn-sm ai-overview-cta">
            管理 MCP
          </Link>
        </article>
      </div>

      {usage && (
        <div className="card ai-overview-usage">
          <h3>今日用量估算</h3>
          <div className="ai-usage-metrics">
            <article className="studio-metric-card">
              <span>总请求</span>
              <strong>{usage.totals?.requests ?? 0}</strong>
            </article>
            <article className="studio-metric-card">
              <span>合计 token</span>
              <strong>{(usage.total_tokens ?? 0).toLocaleString()}</strong>
            </article>
          </div>
          <Link to="/ai/models" className="btn btn-ghost btn-sm">
            查看详细用量 →
          </Link>
        </div>
      )}

      {issues.length > 0 && (
        <div className="card ai-overview-alerts" role="status">
          <h3>待处理</h3>
          <ul className="ai-overview-alert-list">
            {issues.map((issue) => (
              <li key={issue.text}>
                <span>{issue.text}</span>
                <Link to={issue.to} className="btn btn-ghost btn-sm">
                  去修复
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ai-overview-footer">
        <Link to="/ai/mcp" className="btn btn-ghost">
          MCP 扩展 →
        </Link>
        <Link to="/ai/skills/discover" className="btn btn-ghost">
          发现安装新技能 →
        </Link>
        <button type="button" className="btn btn-ghost" onClick={load}>
          刷新状态
        </button>
      </div>
    </section>
  )
}
