import { useCallback, useEffect, useState } from 'react'
import {
  createVersion,
  deleteVersion,
  getVersionDiff,
  listVersions,
  restoreVersion,
} from '../../api.js'
import VersionDiffCard from './VersionDiffCard.jsx'

export default function VersionsPanel({ projectId, showToast }) {
  const [versions, setVersions] = useState([])
  const [versionDiff, setVersionDiff] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')

  const loadVersions = useCallback(async () => {
    if (!projectId) {
      setVersions([])
      setVersionDiff(null)
      return
    }
    setLoading(true)
    setVersionDiff(null)
    try {
      const list = await listVersions(projectId)
      setVersions(list || [])
    } catch (err) {
      showToast(err.message || '加载版本列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [projectId, showToast])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  const addVersion = async () => {
    if (!projectId) {
      showToast('请先选择项目', 'error')
      return
    }
    setBusy('version')
    try {
      const created = await createVersion(projectId, {})
      setVersions((prev) => [created, ...prev])
      showToast('已创建版本', 'success')
    } catch (err) {
      showToast(err.message || '创建版本失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const removeVersion = async (id) => {
    if (!projectId) return
    setBusy(`version:${id}`)
    try {
      await deleteVersion(projectId, id)
      setVersions((prev) => prev.filter((v) => v.id !== id))
      setVersionDiff((prev) => {
        const vid = prev?.version_id || prev?.snapshot_id
        return vid === id ? null : prev
      })
      showToast('已删除版本', 'success')
    } catch (err) {
      showToast(err.message || '删除版本失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const viewVersionDiff = async (id) => {
    if (!projectId) return
    setBusy(`diff:${id}`)
    try {
      const diff = await getVersionDiff(projectId, id)
      setVersionDiff(diff)
    } catch (err) {
      showToast(err.message || '加载差异失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const restoreVersionToWorkspace = async (id) => {
    if (!projectId) return
    setBusy(`restore:${id}`)
    try {
      const res = await restoreVersion(projectId, id)
      showToast(`恢复完成：${res.restored_files} 个文件`, 'success')
      const diff = await getVersionDiff(projectId, id)
      setVersionDiff(diff)
    } catch (err) {
      showToast(err.message || '恢复版本失败', 'error')
    } finally {
      setBusy('')
    }
  }

  if (!projectId) {
    return (
      <section className="studio-panel">
        <p className="muted">请先创建或选择一个项目。</p>
      </section>
    )
  }

  return (
    <section className="studio-panel">
      <div className="studio-block-head">
        <h3>版本列表</h3>
        <div className="studio-head-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy === 'version' || loading}
            onClick={addVersion}
          >
            + 创建版本
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">加载中…</p>
      ) : versions.length === 0 ? (
        <p className="muted">还没有历史版本，建议在大改前创建一个。</p>
      ) : (
        <ul className="studio-list studio-list-detailed">
          {versions.map((v) => (
            <li key={v.id}>
              <div>
                <strong>{v.title}</strong>
                <p className="muted">
                  {v.notes}
                  {v.file_count != null &&
                    ` · ${v.file_count} 文件 · ${(v.total_words || 0).toLocaleString()} 字`}
                </p>
              </div>
              <div className="studio-row-actions">
                <span className="muted">{new Date(v.created_at).toLocaleString()}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy === `diff:${v.id}` || busy === `restore:${v.id}`}
                  onClick={() => viewVersionDiff(v.id)}
                >
                  差异
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy === `restore:${v.id}` || busy === `diff:${v.id}`}
                  onClick={() => restoreVersionToWorkspace(v.id)}
                >
                  恢复
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy === `version:${v.id}`}
                  onClick={() => removeVersion(v.id)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <VersionDiffCard versionDiff={versionDiff} />
    </section>
  )
}
