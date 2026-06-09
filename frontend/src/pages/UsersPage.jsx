import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { createUser, deleteUser, listUsers, updateUser } from '../api.js'
import { useToast } from '../components/Toast.jsx'
import Modal from '../components/Modal.jsx'
import PageSlogan from '../components/PageSlogan.jsx'

const ROLE_LABEL = {
  super_admin: '超级管理员',
  user: '普通用户',
}

export default function UsersPage() {
  const { isAdmin } = useAuth()
  const showToast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    username: '',
    password: '',
    display_name: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await listUsers())
    } catch (e) {
      showToast(e.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  if (!isAdmin) return <Navigate to="/" replace />

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createUser(form)
      showToast('用户已创建')
      setModalOpen(false)
      setForm({ username: '', password: '', display_name: '' })
      load()
    } catch (err) {
      showToast(err.message || '创建失败', 'error')
    }
  }

  const toggleDisabled = async (user) => {
    if (user.role === 'super_admin') return
    try {
      await updateUser(user.id, { disabled: !user.disabled })
      load()
    } catch (e) {
      showToast(e.message || '操作失败', 'error')
    }
  }

  const handleDelete = async (user) => {
    if (user.role === 'super_admin') return
    if (!window.confirm(`确定删除用户 ${user.username}？`)) return
    try {
      await deleteUser(user.id)
      showToast('已删除')
      load()
    } catch (e) {
      showToast(e.message || '删除失败', 'error')
    }
  }

  return (
    <div className="page users-page">
      <header className="page-header">
        <div>
          <h1>用户管理</h1>
          <PageSlogan text="创建账号并分配角色；项目权限在各项目的「共享」中设置" />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
          新建用户
        </button>
      </header>

      {loading ? (
        <p className="muted">加载中…</p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>显示名</th>
                <th>角色</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.display_name}</td>
                  <td>{ROLE_LABEL[user.role] || user.role}</td>
                  <td>{user.disabled ? '已禁用' : '正常'}</td>
                  <td className="users-actions">
                    {user.role !== 'super_admin' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleDisabled(user)}
                        >
                          {user.disabled ? '启用' : '禁用'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm danger"
                          onClick={() => handleDelete(user)}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新建用户">
        <form className="users-form" onSubmit={handleCreate}>
          <label className="field">
            <span>用户名</span>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              minLength={2}
            />
          </label>
          <label className="field">
            <span>显示名</span>
            <input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>
            新建账号默认为普通用户权限
          </p>
          <div className="share-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">创建</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
