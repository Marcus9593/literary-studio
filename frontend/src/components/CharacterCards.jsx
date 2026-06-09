import { useState } from 'react'

const EMPTY = { name: '', role: '', notes: '' }

export default function CharacterCards({ items = [], onSave, busy = false }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [adding, setAdding] = useState(false)

  const openEdit = (item) => {
    setEditing(item.id || item.name)
    setDraft({
      name: item.name || '',
      role: item.role || item.archetype || '',
      notes: item.notes || item.summary || '',
    })
    setAdding(false)
  }

  const openAdd = () => {
    setAdding(true)
    setEditing(null)
    setDraft({ ...EMPTY })
  }

  const cancel = () => {
    setEditing(null)
    setAdding(false)
    setDraft({ ...EMPTY })
  }

  const save = async () => {
    if (!draft.name.trim()) return
    const nextItems = [...items]
    if (adding) {
      nextItems.push({
        name: draft.name.trim(),
        role: draft.role.trim(),
        notes: draft.notes.trim(),
      })
    } else {
      const idx = nextItems.findIndex((it) => (it.id || it.name) === editing)
      if (idx >= 0) {
        nextItems[idx] = {
          ...nextItems[idx],
          name: draft.name.trim(),
          role: draft.role.trim(),
          notes: draft.notes.trim(),
        }
      }
    }
    await onSave?.({ characters: { items: nextItems } })
    cancel()
  }

  const remove = async (item) => {
    if (!window.confirm(`确定删除角色「${item.name}」？`)) return
    const nextItems = items.filter((it) => (it.id || it.name) !== (item.id || item.name))
    await onSave?.({ characters: { items: nextItems } })
  }

  if (!items.length && !adding) {
    return (
      <div className="character-cards-empty">
        <p className="muted">暂无人物条目，可从设定集同步或手动添加。</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={openAdd}>添加人物</button>
      </div>
    )
  }

  return (
    <div className="character-cards">
      <div className="character-cards-grid">
        {items.map((item) => {
          const key = item.id || item.name
          const isEditing = editing === key && !adding
          if (isEditing) {
            return (
              <article key={key} className="character-card character-card-editing">
                <input
                  className="input"
                  placeholder="姓名"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="角色定位"
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                />
                <textarea
                  className="input"
                  rows={3}
                  placeholder="备注"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
                <div className="character-card-actions">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>保存</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>取消</button>
                </div>
              </article>
            )
          }
          return (
            <article key={key} className="character-card">
              <h4>{item.name}</h4>
              {(item.role || item.archetype) && (
                <p className="character-card-role muted">{item.role || item.archetype}</p>
              )}
              {(item.notes || item.summary) && (
                <p className="character-card-notes">{item.notes || item.summary}</p>
              )}
              <div className="character-card-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>编辑</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(item)}>删除</button>
              </div>
            </article>
          )
        })}
        {adding && (
          <article className="character-card character-card-editing">
            <input
              className="input"
              placeholder="姓名"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className="input"
              placeholder="角色定位"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
            <textarea
              className="input"
              rows={3}
              placeholder="备注"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
            <div className="character-card-actions">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>添加</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>取消</button>
            </div>
          </article>
        )}
      </div>
      {!adding && (
        <button type="button" className="btn btn-secondary btn-sm character-cards-add" onClick={openAdd}>
          添加人物
        </button>
      )}
    </div>
  )
}
