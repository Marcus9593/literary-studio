import { useEffect, useState } from 'react'

const PSYCH_FIELDS = [
  { key: 'want', label: 'Want · 外部目标' },
  { key: 'need', label: 'Need · 内在需求' },
  { key: 'ghost', label: 'Ghost · 幽灵/过去' },
  { key: 'wound', label: 'Wound · 创伤' },
  { key: 'lie', label: 'Lie · 自我欺骗' },
]

const ARC_STAGES = ['setup', 'rising', 'crisis', 'resolution']

export default function CharacterWorkshop({
  items = [],
  voiceDnas = [],
  arcResult = null,
  onSave,
  onTrainVoice,
  onSaveVoiceDna,
  busy = false,
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id || items[0]?.name || null)
  const [draft, setDraft] = useState({})
  const [dnaDraft, setDnaDraft] = useState(null)

  const selected = items.find((c) => (c.id || c.name) === selectedId)
  const dna = voiceDnas.find((d) => d.character_id === (selected?.id || selected?.name))
  const arc = arcResult?.character_arcs?.find((a) => a.name === selected?.name)

  const syncDnaDraft = (dnaRow) => {
    if (!dnaRow) {
      setDnaDraft(null)
      return
    }
    setDnaDraft({
      tone: dnaRow.tone || '',
      formality: dnaRow.formality || '',
      catchphrases: (dnaRow.catchphrases || []).join('、'),
      sample_dialogue: dnaRow.sample_dialogue || '',
      forbidden_words: (dnaRow.forbidden_words || []).join('、'),
    })
  }

  const openEdit = (item) => {
    const id = item.id || item.name
    setSelectedId(id)
    const row = voiceDnas.find((d) => d.character_id === id)
    syncDnaDraft(row)
    setDraft({
      want: item.want || '',
      need: item.need || '',
      ghost: item.ghost || '',
      wound: item.wound || '',
      lie: item.lie || '',
      arc_stage: item.arc_stage || 'setup',
      arc_summary: item.arc_summary || '',
      voice_description: item.voice_description || item.voice || '',
    })
  }

  const save = async () => {
    if (!selected) return
    const nextItems = items.map((it) => {
      if ((it.id || it.name) !== selectedId) return it
      return { ...it, ...draft }
    })
    await onSave?.({ characters: { items: nextItems } })
  }

  useEffect(() => {
    if (!selectedId) return
    const row = voiceDnas.find((d) => d.character_id === selectedId)
    syncDnaDraft(row)
  }, [selectedId, voiceDnas])

  useEffect(() => {
    if (selectedId || !items[0]) return
    const item = items[0]
    const id = item.id || item.name
    setSelectedId(id)
    const row = voiceDnas.find((d) => d.character_id === id)
    syncDnaDraft(row)
    setDraft({
      want: item.want || '',
      need: item.need || '',
      ghost: item.ghost || '',
      wound: item.wound || '',
      lie: item.lie || '',
      arc_stage: item.arc_stage || 'setup',
      arc_summary: item.arc_summary || '',
      voice_description: item.voice_description || item.voice || '',
    })
  }, [items, selectedId])

  if (!items.length) {
    return <p className="muted">请先在知识库添加人物，再在此编辑心理维度与声音设定。</p>
  }

  return (
    <div className="character-workshop">
      <div className="character-workshop-list">
        {items.map((item) => {
          const id = item.id || item.name
          const active = id === selectedId
          return (
            <button
              key={id}
              type="button"
              className={`character-workshop-item ${active ? 'active' : ''}`}
              onClick={() => openEdit(item)}
            >
              <strong>{item.name}</strong>
              <span className="muted">{item.role || '角色'}</span>
              {item.arc_stage && <span className="tag tag-sm">{item.arc_stage}</span>}
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="character-workshop-editor">
          <h4>{selected.name} · 心理模型</h4>
          {arc && (
            <div className={`engine-arc-banner engine-level-${arc.score >= 7 ? 'pass' : arc.score >= 4 ? 'soft' : 'hard'}`}>
              弧线评分 {arc.score}/10 · {arc.arc_progress}
              {arc.issues?.length > 0 && <p className="hint">{arc.issues.join('；')}</p>}
            </div>
          )}
          <div className="character-workshop-grid">
            {PSYCH_FIELDS.map(({ key, label }) => (
              <label key={key} className="form-field">
                <span>{label}</span>
                <textarea
                  rows={2}
                  value={draft[key] ?? selected[key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="form-field">
              <span>弧线阶段</span>
              <select
                value={draft.arc_stage ?? selected.arc_stage ?? 'setup'}
                onChange={(e) => setDraft((d) => ({ ...d, arc_stage: e.target.value }))}
              >
                {ARC_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="form-field form-field-wide">
              <span>声音描述</span>
              <input
                type="text"
                value={draft.voice_description ?? selected.voice_description ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, voice_description: e.target.value }))}
                placeholder="正式/口语/冷峻/讽刺…"
              />
            </label>
          </div>
          <div className="character-workshop-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
              {busy ? '保存中…' : '保存角色档案'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => onTrainVoice?.(selected)}
            >
              从正文训练 Voice DNA
            </button>
          </div>

          {dna && dnaDraft && (
            <div className="studio-hints-card voice-dna-card">
              <h4>Voice DNA</h4>
              <ul className="voice-dna-stats">
                <li>平均句长：{dna.avg_sentence}</li>
                <li>疑问句比例：{((dna.question_ratio || 0) * 100).toFixed(0)}%</li>
              </ul>
              <div className="character-workshop-grid">
                <label className="form-field">
                  <span>语气</span>
                  <input
                    type="text"
                    value={dnaDraft.tone}
                    onChange={(e) => setDnaDraft((d) => ({ ...d, tone: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span>正式度</span>
                  <input
                    type="text"
                    value={dnaDraft.formality}
                    onChange={(e) => setDnaDraft((d) => ({ ...d, formality: e.target.value }))}
                  />
                </label>
                <label className="form-field form-field-wide">
                  <span>口头禅（顿号分隔）</span>
                  <input
                    type="text"
                    value={dnaDraft.catchphrases}
                    onChange={(e) => setDnaDraft((d) => ({ ...d, catchphrases: e.target.value }))}
                  />
                </label>
                <label className="form-field form-field-wide">
                  <span>禁用词（顿号分隔）</span>
                  <input
                    type="text"
                    value={dnaDraft.forbidden_words}
                    onChange={(e) => setDnaDraft((d) => ({ ...d, forbidden_words: e.target.value }))}
                  />
                </label>
                <label className="form-field form-field-wide">
                  <span>对白样例</span>
                  <textarea
                    rows={2}
                    value={dnaDraft.sample_dialogue}
                    onChange={(e) => setDnaDraft((d) => ({ ...d, sample_dialogue: e.target.value }))}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => onSaveVoiceDna?.(selected, {
                  tone: dnaDraft.tone,
                  formality: dnaDraft.formality,
                  catchphrases: dnaDraft.catchphrases.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
                  forbidden_words: dnaDraft.forbidden_words.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
                  sample_dialogue: dnaDraft.sample_dialogue,
                })}
              >
                保存 Voice DNA
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
