import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { useToast } from '../../../components/Toast.jsx'
import {
  getDefaultSkillCapabilities,
  getToolsOverview,
  listInstalledSkills,
  setDefaultSkill,
  setLiteraryWriterRoot,
} from '../../../api.js'
import FancySelect from '../../../components/FancySelect.jsx'

export default function AiSkillsPanel() {
  const showToast = useToast()
  const [overview, setOverview] = useState(null)
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [lwPath, setLwPath] = useState('')
  const [defaultSkillId, setDefaultSkillId] = useState('')
  const [defaultSubSkill, setDefaultSubSkill] = useState('')
  const [preflight, setPreflight] = useState(null)

  const refreshOverview = useCallback(async () => {
    const data = await getToolsOverview()
    setOverview(data)
    setLwPath(data?.literary_writer?.path || '')
    const ds = data?.default_skill
    if (ds?.valid) {
      setDefaultSkillId(ds.skill_id || '')
      setDefaultSubSkill(ds.sub_skill || '')
    } else {
      setDefaultSkillId('')
      setDefaultSubSkill('')
    }
    return data
  }, [])

  const refreshLocal = useCallback(async () => {
    const items = await listInstalledSkills()
    setSkills(items)
    return items
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([refreshOverview(), refreshLocal()])
    } catch (err) {
      showToast(err.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [refreshLocal, refreshOverview, showToast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const onSetLiteraryWriter = async () => {
    if (!lwPath.trim()) return
    setBusy('lw')
    try {
      await setLiteraryWriterRoot(lwPath.trim())
      showToast('literary-writer 路径已更新', 'success')
      await refreshOverview()
      await refreshLocal()
    } catch (err) {
      showToast(err.message || '设置失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const selectedDefaultSkill = skills.find((s) => s.id === defaultSkillId)
  const subSkillOptions = selectedDefaultSkill?.sub_skills || []

  const onSaveDefaultSkill = async () => {
    setBusy('default-skill')
    try {
      if (!defaultSkillId) {
        await setDefaultSkill({ skill_id: '' })
        showToast('已清除默认 Skill，对话恢复自动路由', 'success')
      } else {
        await setDefaultSkill({
          skill_id: defaultSkillId,
          sub_skill: defaultSubSkill || null,
        })
        const label = selectedDefaultSkill?.name
          + (defaultSubSkill ? ` / ${defaultSubSkill}` : '')
        showToast(`默认 Skill 已设为：${label}`, 'success')
      }
      await refreshOverview()
    } catch (err) {
      showToast(err.message || '保存失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onRunPreflight = async () => {
    setBusy('preflight')
    try {
      const cap = await getDefaultSkillCapabilities()
      const caps = cap?.capabilities
      const commandCount = caps?.commands ? Object.keys(caps.commands).length : 0
      const invocable = Boolean(caps?.entry) || commandCount > 0
      const result = { invocable, command_count: commandCount }
      setPreflight(result)
      if (invocable) {
        showToast(`默认 Skill 脚本可调用（${commandCount} 个命令）`, 'success')
      } else {
        showToast('当前 Skill 无可用脚本入口', 'error')
      }
    } catch (err) {
      setPreflight({ invocable: false, reason: err.message })
      showToast(err.message || '检查失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const onSetSkillAsDefault = async (skill) => {
    setDefaultSkillId(skill.id)
    setDefaultSubSkill('')
    setBusy('default-skill')
    try {
      await setDefaultSkill({ skill_id: skill.id, sub_skill: null })
      showToast(`默认 Skill 已设为：${skill.name}`, 'success')
      await refreshOverview()
    } catch (err) {
      showToast(err.message || '保存失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const lw = overview?.literary_writer || {}

  if (loading) {
    return <p className="muted">加载中…</p>
  }

  return (
    <section className="tools-section">
      <div className="ai-panel-toolbar">
        <p className="hint ai-panel-hint">
          默认 Skill 决定对话与创作流程；平台可通过 Skill 适配器调用 skill 内脚本。
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!!busy}
          onClick={loadAll}
        >
          刷新
        </button>
      </div>

      <div className="tools-default-skill-panel">
        <div className="tools-default-skill-head">
          <div>
            <strong>默认 Skill（对话引擎）</strong>
            <p className="muted">
              配置后 Claude Code 将始终按此 Skill 工作；仅在对话里明确说「改用 xxx」时才临时切换。
            </p>
          </div>
          {overview?.default_skill?.valid && (
            <StatusBadge variant="ok">
              当前：{overview.default_skill.label}
            </StatusBadge>
          )}
        </div>
        <div className="tools-default-skill-form">
          <label className="tools-fancy-field">
            <span className="tools-field-label">主 Skill</span>
            <FancySelect
              variant="form"
              value={defaultSkillId}
              onChange={(v) => {
                setDefaultSkillId(v)
                setDefaultSubSkill('')
              }}
              placeholder="不固定（Claude 自动选择）"
              options={[
                { value: '', label: '不固定（Claude 自动选择）' },
                ...skills.map((s) => ({ value: s.id, label: s.name })),
              ]}
              label="主 Skill"
            />
          </label>
          {subSkillOptions.length > 0 && (
            <label className="tools-fancy-field">
              <span className="tools-field-label">子 Skill（可选）</span>
              <FancySelect
                variant="form"
                value={defaultSubSkill}
                onChange={setDefaultSubSkill}
                placeholder="按主 Skill 路由表自动选择"
                options={[
                  { value: '', label: '按主 Skill 路由表自动选择' },
                  ...subSkillOptions.map((sub) => ({ value: sub, label: sub })),
                ]}
                label="子 Skill"
              />
            </label>
          )}
          <div className="tools-default-skill-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy === 'default-skill'}
              onClick={onSaveDefaultSkill}
            >
              保存默认 Skill
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy === 'preflight' || !defaultSkillId}
              onClick={onRunPreflight}
            >
              {busy === 'preflight' ? '检查中…' : '健康检查'}
            </button>
            {defaultSkillId && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy === 'default-skill'}
                onClick={() => {
                  setDefaultSkillId('')
                  setDefaultSubSkill('')
                }}
              >
                重置表单
              </button>
            )}
          </div>
          {preflight && (
            <p className={`hint ai-preflight-result ${preflight.invocable ? 'ok' : 'warn'}`}>
              {preflight.invocable
                ? `脚本可用 · ${preflight.command_count ?? 0} 个命令`
                : preflight.reason || '无可用脚本'}
            </p>
          )}
        </div>
      </div>

      <details className="ai-advanced-details">
        <summary>高级设置</summary>
        <div className="tools-banner">
          <div>
            <strong>literary-writer 技能路径</strong>
            <p className="muted tools-lw-status">
              写章引擎依赖此目录下的 scripts/webnovel.py{' '}
              {lw.webnovel_cli ? (
                <StatusBadge variant="ok">webnovel 脚本可用</StatusBadge>
              ) : (
                <StatusBadge variant="warn" title={lw.webnovel_path || 'scripts/webnovel.py'}>
                  webnovel 脚本未找到
                </StatusBadge>
              )}
            </p>
          </div>
          <div className="tools-inline-form">
            <input
              type="text"
              value={lwPath}
              onChange={(e) => setLwPath(e.target.value)}
              placeholder="~/.claude/skills/literary-writer"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy === 'lw'}
              onClick={onSetLiteraryWriter}
            >
              应用
            </button>
          </div>
        </div>
        <p className="tools-scan-hint muted">
          扫描目录：{(overview?.skill_scan_dirs || []).join(' · ')}
        </p>
      </details>

      <h3 className="ai-section-title">已安装技能（{skills.length}）</h3>

      <div className="card-grid tools-skill-grid">
        {skills.map((s, idx) => {
          const isDefault = overview?.default_skill?.skill_id === s.id
          return (
            <article
              key={s.id}
              className={`tool-skill-card ${s.is_literary_writer ? 'highlight' : ''}`}
              style={{ '--item-delay': `${idx * 45}ms` }}
            >
              <div className="tool-skill-head">
                <h3>{s.name}</h3>
                {isDefault && <StatusBadge variant="ok">默认</StatusBadge>}
                {s.is_literary_writer && <StatusBadge variant="info">核心</StatusBadge>}
                {s.invocable && <StatusBadge variant="neutral">可调用</StatusBadge>}
                {s.has_scripts && !s.invocable && <StatusBadge variant="neutral">脚本</StatusBadge>}
              </div>
              <p>{s.description || '无描述'}</p>
              {s.sub_skills?.length > 0 && (
                <p className="tool-sub">子技能：{s.sub_skills.join('、')}</p>
              )}
              <div className="tool-discover-actions" style={{ marginTop: 12 }}>
                {!isDefault && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy}
                    onClick={() => onSetSkillAsDefault(s)}
                  >
                    设为默认
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {skills.length === 0 && (
        <p className="empty-hint">未扫描到本地 Skills，请检查 ~/.claude/skills 等目录，或前往「发现安装」。</p>
      )}
    </section>
  )
}
