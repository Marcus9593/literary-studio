import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getProject,
  getStoryKnowledge,
  updateStoryKnowledge,
  getCharacterGraph,
  listVoiceDnas,
  trainVoiceDna,
  saveVoiceDna,
  runNarrativeAnalysis,
} from '../../../api.js'
import StoryOsPage from '../../../components/StoryOsPage.jsx'
import CharacterWorkshop from '../../../components/CharacterWorkshop.jsx'
import CharacterGraph from '../../../components/CharacterGraph.jsx'
import { useToast } from '../../../components/Toast.jsx'

export default function StoryCharactersPage() {
  const { projectId } = useParams()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [kb, setKb] = useState(null)
  const [graph, setGraph] = useState(null)
  const [voiceDnas, setVoiceDnas] = useState([])
  const [arcResult, setArcResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getProject(projectId),
      getStoryKnowledge(projectId),
      getCharacterGraph(projectId).catch(() => ({ nodes: [], edges: [] })),
      listVoiceDnas(projectId).catch(() => ({ items: [] })),
      runNarrativeAnalysis(projectId).catch(() => null),
    ])
      .then(([p, k, g, v, analysis]) => {
        setProject(p)
        setKb(k)
        setGraph(g)
        setVoiceDnas(v?.items || v || [])
        setArcResult(analysis?.character_arc || null)
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const onSave = async (patch) => {
    setBusy(true)
    try {
      const k = await updateStoryKnowledge(projectId, patch)
      setKb(k)
      showToast('角色档案已保存')
      const g = await getCharacterGraph(projectId)
      setGraph(g)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onSaveVoiceDna = async (character, body) => {
    const charId = character.id || character.name
    setBusy(true)
    try {
      const dna = await saveVoiceDna(projectId, charId, body)
      setVoiceDnas((prev) => {
        const rest = prev.filter((d) => d.character_id !== charId)
        return [...rest, dna]
      })
      showToast('Voice DNA 已保存')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onTrainVoice = async (character) => {
    const charId = character.id || character.name
    setBusy(true)
    try {
      const dna = await trainVoiceDna(projectId, charId, { character_name: character.name })
      setVoiceDnas((prev) => {
        const rest = prev.filter((d) => d.character_id !== charId)
        return [...rest, dna]
      })
      showToast('Voice DNA 训练完成')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <StoryOsPage
      className="story-characters-page"
      projectTitle={project?.title}
      loading={loading}
      loadingLabel="加载角色工坊…"
    >
      <header className="page-header story-page-intro">
        <h2>角色工坊</h2>
        <p className="hint">心理模型 Want/Need/Ghost、Voice DNA 与关系图谱</p>
      </header>

      <section className="card">
        <CharacterWorkshop
          items={kb?.characters?.items || []}
          voiceDnas={voiceDnas}
          arcResult={arcResult}
          onSave={onSave}
          onTrainVoice={onTrainVoice}
          onSaveVoiceDna={onSaveVoiceDna}
          busy={busy}
        />
      </section>

      <section className="card">
        <h3>角色关系图</h3>
        <p className="hint">基于知识库人物与关系自动生成</p>
        <CharacterGraph data={graph} />
      </section>
    </StoryOsPage>
  )
}
