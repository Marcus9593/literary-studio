import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { getProjectShares, updateProjectShares } from '../api.js'
import { useToast } from './Toast.jsx'

export default function ProjectShareModal({ project, open, onClose, onSaved }) {
  const showToast = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [shares, setShares] = useState([])

  useEffect(() => {
    if (!open || !project?.id) return
    setLoading(true)
    getProjectShares(project.id)
      .then((data) => {
        setCandidates(data.candidates || [])
        setShares(data.shares || [])
      })
      .catch((e) => showToast(e.message || '加载失败', 'error'))
      .finally(() => setLoading(false))
  }, [open, project?.id, showToast])

  const toggleUser = (user) => {
    const exists = shares.find((s) => s.user_id === user.id)
    if (exists) {
      setShares(shares.filter((s) => s.user_id !== user.id))
    } else {
      setShares([...shares, { user_id: user.id, username: user.username, role: 'read' }])
    }
  }

  const setRole = (userId, role) => {
    setShares(shares.map((s) => (s.user_id === userId ? { ...s, role } : s)))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateProjectShares(project.id, shares)
      showToast('权限已更新')
      onSaved?.(updated)
      onClose?.()
    } catch (e) {
      showToast(e.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`共享项目 · ${project?.title || ''}`}>
      <div className="share-modal">
        <p className="share-modal-hint">
          仅项目所有者可将项目共享给其他用户。被共享用户默认只读；授予「可编辑」后可修改正文与设定。
        </p>
        {loading ? (
          <p className="muted">加载中…</p>
        ) : candidates.length === 0 ? (
          <p className="muted">暂无其他用户。请管理员在「用户管理」中创建账号。</p>
        ) : (
          <ul className="share-user-list">
            {candidates.map((user) => {
              const share = shares.find((s) => s.user_id === user.id)
              const checked = Boolean(share)
              return (
                <li key={user.id} className="share-user-row">
                  <label className="share-user-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUser(user)}
                    />
                    <span>
                      <strong>{user.display_name || user.username}</strong>
                      <span className="muted"> @{user.username}</span>
                    </span>
                  </label>
                  {checked && (
                    <select
                      value={share.role}
                      onChange={(e) => setRole(user.id, e.target.value)}
                      className="share-role-select"
                    >
                      <option value="read">只读</option>
                      <option value="write">可编辑</option>
                    </select>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <div className="share-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
