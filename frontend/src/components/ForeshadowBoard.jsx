/** 伏笔看板：可拖拽改状态、写回知识库 */
import { useState } from 'react'

const COLUMNS = [
  { id: 'planted', label: '已埋', status: 'planted' },
  { id: 'pending', label: '待收', status: 'pending' },
  { id: 'resolved', label: '已收', status: 'resolved' },
]

const STATUS_MAP = {
  planted: 'planted',
  pending: 'pending',
  resolved: 'resolved',
  已埋: 'planted',
  待收: 'pending',
  已收: 'resolved',
}

function normalizeStatus(item) {
  const raw = item.status || item.state || 'pending'
  return STATUS_MAP[raw] || STATUS_MAP[String(raw).toLowerCase()] || 'pending'
}

function itemId(item, index) {
  return item.id || item.legacy_id || `fs-${index}-${item.title || item.name || 'x'}`
}

export default function ForeshadowBoard({
  items = [],
  foreshadowsBundle,
  onSave,
  showToast,
}) {
  const [busy, setBusy] = useState('')
  const [dragId, setDragId] = useState('')
  const list = Array.isArray(items) ? items : items?.items || []

  const persistItems = async (nextItems) => {
    if (!onSave) return
    setBusy('save')
    try {
      await onSave({
        foreshadows: {
          ...(foreshadowsBundle || { version: 1 }),
          items: nextItems,
        },
      })
      showToast?.('伏笔已更新', 'success')
    } catch (e) {
      showToast?.(e.message || '保存失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const moveItem = (id, targetStatus) => {
    const next = list.map((item, i) => {
      if (itemId(item, i) !== id) return item
      return { ...item, status: targetStatus }
    })
    persistItems(next)
  }

  const onDragStart = (e, id) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDrop = (e, targetStatus) => {
    e.preventDefault()
    if (dragId) moveItem(dragId, targetStatus)
    setDragId('')
  }

  const addForeshadow = () => {
    const title = window.prompt('伏笔标题')
    if (!title?.trim()) return
    const next = [
      {
        id: `fs_${Date.now().toString(36)}`,
        title: title.trim(),
        status: 'planted',
        description: '',
      },
      ...list,
    ]
    persistItems(next)
  }

  if (!list.length) {
    return (
      <div>
        <p className="muted">暂无结构化伏笔，可从设定集同步或手动添加。</p>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={addForeshadow}>
          + 添加伏笔
        </button>
      </div>
    )
  }

  const grouped = Object.fromEntries(COLUMNS.map((c) => [c.id, []]))
  list.forEach((item, i) => {
    grouped[normalizeStatus(item)].push({ item, id: itemId(item, i) })
  })

  return (
    <div className="foreshadow-board-wrap">
      <div className="foreshadow-board-head">
        <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={addForeshadow}>
          + 添加伏笔
        </button>
        {busy && <span className="muted">保存中…</span>}
      </div>
      <div className="foreshadow-board">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="foreshadow-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, col.status)}
          >
            <h4>{col.label} ({grouped[col.id].length})</h4>
            <ul>
              {grouped[col.id].map(({ item, id }) => (
                <li
                  key={id}
                  className="foreshadow-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, id)}
                >
                  <strong>{item.title || item.name || item.hook || '未命名伏笔'}</strong>
                  {item.description && <p>{item.description}</p>}
                  {item.chapter && <span className="muted">章节：{item.chapter}</span>}
                  <div className="foreshadow-card-actions">
                    {COLUMNS.filter((c) => c.status !== normalizeStatus(item)).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!!busy}
                        onClick={() => moveItem(id, c.status)}
                      >
                        → {c.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
