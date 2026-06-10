import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getProject,
  listCanonRules,
  createCanonRule,
  updateCanonRule,
  deleteCanonRule,
  listEngineMemoryFacts,
  listEngineMemorySummaries,
  listEnginePipelines,
  listEngineCriticReports,
} from '../../../api.js'
import StoryOsPage from '../../../components/StoryOsPage.jsx'
import { useToast } from '../../../components/Toast.jsx'

const TABS = [
  { id: 'canon', label: 'Canon 规则' },
  { id: 'memory', label: '结构化记忆' },
  { id: 'pipelines', label: '流水线记录' },
  { id: 'reports', label: '审稿历史' },
]

const LEVEL_LABEL = { immutable: '不可变', semi_mutable: '半可变', mutable: '可变' }
const GOV_LABEL = { APPROVE: '通过', REVISE: '修订', REJECT: '拒绝' }

export default function StoryEnginePage() {
  const { projectId } = useParams()
  const showToast = useToast()
  const [tab, setTab] = useState('canon')
  const [project, setProject] = useState(null)
  const [canon, setCanon] = useState([])
  const [facts, setFacts] = useState([])
  const [summaries, setSummaries] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({
    title: '', content: '', level: 'mutable', category: 'world_rule',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, c, f, s, pl, reps] = await Promise.all([
        getProject(projectId),
        listCanonRules(projectId),
        listEngineMemoryFacts(projectId),
        listEngineMemorySummaries(projectId),
        listEnginePipelines(projectId),
        listEngineCriticReports(projectId).catch(() => ({ reports: [] })),
      ])
      setProject(p)
      setCanon(c?.rules || [])
      setFacts(f?.facts || [])
      setSummaries(s?.summaries || [])
      setPipelines(pl?.runs || [])
      setReports(reps?.reports || [])
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const addCanon = async () => {
    if (!draft.title.trim()) return
    setBusy(true)
    try {
      await createCanonRule(projectId, draft)
      setDraft({ title: '', content: '', level: 'mutable', category: 'world_rule' })
      showToast('规则已添加')
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const startEditCanon = (rule) => {
    setEditingId(rule.id)
    setDraft({
      title: rule.title || '',
      content: rule.content || '',
      level: rule.level || 'mutable',
      category: rule.category || 'world_rule',
    })
  }

  const saveEditCanon = async () => {
    if (!editingId) return
    setBusy(true)
    try {
      await updateCanonRule(projectId, editingId, draft)
      setEditingId(null)
      setDraft({ title: '', content: '', level: 'mutable', category: 'world_rule' })
      showToast('规则已更新')
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const cancelEditCanon = () => {
    setEditingId(null)
    setDraft({ title: '', content: '', level: 'mutable', category: 'world_rule' })
  }

  const removeCanon = async (id) => {
    if (!window.confirm('确定删除该 Canon 规则？')) return
    setBusy(true)
    try {
      await deleteCanonRule(projectId, id)
      showToast('已删除')
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <StoryOsPage
      className="story-engine-page"
      projectTitle={project?.title}
      loading={loading}
      loadingLabel="加载编剧室数据…"
    >
      <header className="page-header story-page-intro">
        <h2>编剧室</h2>
        <p className="hint">Canon 世界规则 · 结构化记忆 · Creator→Critic→Governor 流水线历史</p>
      </header>

      <div className="story-engine-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`story-engine-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'canon' && (
        <section className="card">
          <h3>Canon 规则库</h3>
          <p className="hint">immutable 不可被 AI 覆盖；审稿与写稿时自动注入约束</p>
          <div className="canon-add-form">
            <input
              placeholder="规则标题"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
            <select
              value={draft.level}
              onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
            >
              <option value="immutable">不可变</option>
              <option value="semi_mutable">半可变</option>
              <option value="mutable">可变</option>
            </select>
            <textarea
              rows={2}
              placeholder="规则内容"
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            />
            {editingId ? (
              <>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveEditCanon}>
                  保存修改
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelEditCanon}>
                  取消编辑
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={addCanon}>
                添加规则
              </button>
            )}
          </div>
          <ul className="canon-rule-list">
            {canon.map((r) => (
              <li key={r.id} className={`canon-rule-item level-${r.level} ${editingId === r.id ? 'editing' : ''}`}>
                <div className="canon-rule-head">
                  <strong>{r.title}</strong>
                  <span className="tag">{LEVEL_LABEL[r.level] || r.level}</span>
                  <span className="muted">{r.category}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditCanon(r)}>
                    编辑
                  </button>
                  {r.level !== 'immutable' && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeCanon(r.id)}>
                      删除
                    </button>
                  )}
                </div>
                {editingId === r.id ? null : <p>{r.content}</p>}
              </li>
            ))}
            {!canon.length && <p className="muted">暂无 Canon 规则</p>}
          </ul>
        </section>
      )}

      {tab === 'memory' && (
        <>
          <section className="card">
            <h3>叙事摘要</h3>
            <ul className="memory-summary-list">
              {(summaries || []).map((s) => (
                <li key={s.id || s.unit_index}>
                  <strong>单元 {s.unit_index}</strong>
                  <p>{s.summary}</p>
                </li>
              ))}
              {!summaries?.length && <p className="muted">验收通过后会自动写入摘要</p>}
            </ul>
          </section>
          <section className="card">
            <h3>结构化事实</h3>
            <ul className="memory-fact-list">
              {facts.map((f) => (
                <li key={f.id}>
                  <span className="tag">单元 {f.unit_index}</span>
                  <span className="tag">{f.category}</span>
                  <span>{f.fact}</span>
                </li>
              ))}
              {!facts.length && <p className="muted">尚无记忆事实</p>}
            </ul>
          </section>
        </>
      )}

      {tab === 'pipelines' && (
        <section className="card">
          <h3>流水线记录</h3>
          <ul className="pipeline-run-list">
            {pipelines.map((p) => (
              <li key={p.id} className="pipeline-run-item">
                <div className="pipeline-run-head">
                  <strong>#{p.id}</strong>
                  <span className="tag">{p.status}</span>
                  <span className="muted">单元 {p.unit_index}</span>
                  {p.governor_decision && (
                    <span className="tag">{GOV_LABEL[p.governor_decision] || p.governor_decision}</span>
                  )}
                </div>
                {p.workspace_ref && <p className="muted">文稿 {p.workspace_ref}</p>}
                {p.governor_memo && <p className="hint">{p.governor_memo}</p>}
                <p className="muted">修订 {p.revision_count} 次 · {p.created_at?.slice(0, 19)}</p>
              </li>
            ))}
            {!pipelines.length && <p className="muted">尚无流水线记录，可在「作品质量」运行编剧室流水线</p>}
          </ul>
        </section>
      )}

      {tab === 'reports' && (
        <section className="card">
          <h3>审稿历史</h3>
          <ul className="critic-report-list">
            {reports.map((row) => {
              const gov = row.report?.governor_decision?.decision || row.report?.governor_decision
              return (
                <li key={row.id} className="critic-report-item">
                  <div className="pipeline-run-head">
                    <strong>#{row.id}</strong>
                    <span className="tag">{row.scoring_method || 'rules'}</span>
                    {gov && <span className="tag">{GOV_LABEL[gov] || gov}</span>}
                    <span className="muted">单元 {row.unit_index}</span>
                  </div>
                  {row.workspace_ref && <p className="muted">文稿 {row.workspace_ref}</p>}
                  <p className="muted">{row.created_at?.slice(0, 19)}</p>
                </li>
              )
            })}
            {!reports.length && <p className="muted">尚无审稿记录</p>}
          </ul>
        </section>
      )}
    </StoryOsPage>
  )
}
