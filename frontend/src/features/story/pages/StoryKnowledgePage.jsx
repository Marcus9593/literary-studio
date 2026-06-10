import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getProject,
  getStoryKnowledge,
  rebuildStoryKnowledge,
  queryStoryIndex,
  queryStoryCharacter,
  queryStoryRelationship,
  queryStoryTimeline,
  queryStoryForeshadow,
  queryStoryLocation,
  updateStoryKnowledge,
} from '../../../api.js'
import StoryOsPage from '../../../components/StoryOsPage.jsx'
import AssetsPanel from '../../assets/AssetsPanel.jsx'
import ForeshadowBoard from '../../../components/ForeshadowBoard.jsx'
import CharacterCards from '../../../components/CharacterCards.jsx'
import { useToast } from '../../../components/Toast.jsx'

const KB_LABELS = {
  characters: '人物',
  relationships: '关系',
  timeline: '时间线',
  locations: '地点',
  foreshadows: '伏笔',
  story_summary: '全书摘要',
}

export default function StoryKnowledgePage() {
  const { projectId } = useParams()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [kb, setKb] = useState(null)
  const [query, setQuery] = useState('')
  const [queryType, setQueryType] = useState('general')
  const [indexResult, setIndexResult] = useState(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const QUERY_HANDLERS = {
    general: (q) => queryStoryIndex(projectId, q),
    character: (q) => queryStoryCharacter(projectId, q),
    relationship: (q) => queryStoryRelationship(projectId, q),
    timeline: (q) => queryStoryTimeline(projectId, q),
    foreshadow: (q) => queryStoryForeshadow(projectId, q),
    location: (q) => queryStoryLocation(projectId, q),
  }

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getProject(projectId), getStoryKnowledge(projectId)])
      .then(([p, k]) => { setProject(p); setKb(k) })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const onRebuild = () => {
    setBusy(true)
    rebuildStoryKnowledge(projectId)
      .then((k) => {
        setKb(k)
        showToast('已从设定集同步知识库')
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setBusy(false))
  }

  const onSearch = async (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearchBusy(true)
    try {
      const handler = QUERY_HANDLERS[queryType] || QUERY_HANDLERS.general
      const result = await handler(q)
      setIndexResult(result)
    } catch (err) {
      setIndexResult(null)
      showToast(err.message || '索引查询失败', 'error')
    } finally {
      setSearchBusy(false)
    }
  }

  return (
    <StoryOsPage
      className="story-kb-page"
      projectTitle={project?.title}
      loading={loading}
      loadingLabel="加载知识库…"
    >
      <header className="page-header story-page-intro">
        <div className="page-header-row">
          <div>
            <h2>故事知识库</h2>
            <p className="hint">结构化理解作品：人物、关系、时间线、地点、伏笔（查询优先于全文检索）</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onRebuild}>
              {busy ? '同步中…' : '从设定集同步'}
            </button>
          </div>
        </div>
      </header>

      <section className="card story-kb-characters">
        <h3>人物卡片</h3>
        <p className="hint">结构化编辑知识库人物（与设定集同步互补）</p>
        <CharacterCards
          items={kb?.characters?.items || []}
          busy={busy}
          onSave={async (patch) => {
            setBusy(true)
            try {
              const k = await updateStoryKnowledge(projectId, {
                characters: { ...(kb?.characters || {}), ...patch.characters },
              })
              setKb(k)
              showToast('人物已保存')
            } catch (e) {
              showToast(e.message, 'error')
            } finally {
              setBusy(false)
            }
          }}
        />
      </section>

      <section className="card story-kb-foreshadow">
        <h3>伏笔看板</h3>
        <p className="hint">已埋 / 待收 / 已收 — 数据来自知识库同步</p>
        <ForeshadowBoard
          items={kb?.foreshadows?.items}
          foreshadowsBundle={kb?.foreshadows}
          showToast={showToast}
          onSave={async (patch) => {
            const k = await updateStoryKnowledge(projectId, patch)
            setKb(k)
          }}
        />
      </section>

      <section className="card story-kb-assets-embed">
        <h3>创作素材</h3>
        <p className="hint">角色、地点与设定备忘（结构化卡片，可编辑）</p>
        <AssetsPanel projectId={projectId} showToast={showToast} />
      </section>

      <form className="story-query-bar" onSubmit={onSearch}>
        <select
          className="input input-sm"
          value={queryType}
          onChange={(e) => setQueryType(e.target.value)}
          aria-label="查询类型"
        >
          <option value="general">综合</option>
          <option value="character">人物</option>
          <option value="relationship">关系</option>
          <option value="timeline">时间线</option>
          <option value="foreshadow">伏笔</option>
          <option value="location">地点</option>
        </select>
        <input
          className="input"
          placeholder="索引查询，例如：林凡第一次见到苏清月在哪里"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="故事索引查询"
        />
        <button type="submit" className="btn btn-primary" disabled={searchBusy}>
          {searchBusy ? '查询中…' : '查询'}
        </button>
      </form>

      {indexResult && (
        <section className="card story-index-result">
          <h3>索引结果</h3>
          <p className="hint">{indexResult.hint}</p>
          <pre>{JSON.stringify(indexResult, null, 2)}</pre>
        </section>
      )}

      <div className="story-kb-grid">
        {Object.keys(KB_LABELS).filter((key) => key !== 'characters').map((key) => (
          <section key={key} className="card">
            <h3>{KB_LABELS[key]}</h3>
            <pre className="story-kb-pre">{JSON.stringify(kb?.[key], null, 2)}</pre>
          </section>
        ))}
      </div>
    </StoryOsPage>
  )
}
