import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '../../components/StatusBadge.jsx'
import SelectField from '../../components/SelectField.jsx'
import FancySelect from '../../components/FancySelect.jsx'
import {
  createStudioAsset,
  deleteStudioAsset,
  listStudioAssets,
  updateStudioAsset,
} from '../../api.js'

const ASSET_TYPES = ['全部', '角色', '地点', '设定', '待补充']

export default function AssetsPanel({ projectId, showToast }) {
  const [assets, setAssets] = useState([])
  const [assetTypeFilter, setAssetTypeFilter] = useState('全部')
  const [editingAssetId, setEditingAssetId] = useState('')
  const [assetForm, setAssetForm] = useState({ name: '', type: '待补充', note: '' })
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(false)

  const loadAssets = useCallback(async () => {
    if (!projectId) {
      setAssets([])
      return
    }
    setLoading(true)
    try {
      const result = await listStudioAssets(projectId)
      setAssets(result || [])
    } catch (err) {
      showToast(err.message || '加载素材失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [projectId, showToast])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const addAsset = async () => {
    if (!projectId) {
      showToast('请先选择项目', 'error')
      return
    }
    setBusy('asset')
    try {
      const created = await createStudioAsset({ project_id: projectId })
      setAssets((prev) => [created, ...prev])
      showToast('已新增素材', 'success')
    } catch (err) {
      showToast(err.message || '新增素材失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const removeAsset = async (id) => {
    if (!projectId) return
    setBusy(`asset:${id}`)
    try {
      await deleteStudioAsset(id, projectId)
      setAssets((prev) => prev.filter((a) => a.id !== id))
      showToast('已删除素材', 'success')
    } catch (err) {
      showToast(err.message || '删除素材失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const beginEditAsset = (asset) => {
    setEditingAssetId(asset.id)
    setAssetForm({
      name: asset.name || '',
      type: asset.type || '待补充',
      note: asset.note || '',
    })
  }

  const cancelEditAsset = () => {
    setEditingAssetId('')
    setAssetForm({ name: '', type: '待补充', note: '' })
  }

  const saveAssetEdit = async () => {
    if (!editingAssetId) return
    setBusy(`asset-edit:${editingAssetId}`)
    try {
      const updated = await updateStudioAsset(editingAssetId, assetForm)
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      showToast('素材已更新', 'success')
      cancelEditAsset()
    } catch (err) {
      showToast(err.message || '更新素材失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const assetTypeOptions = ASSET_TYPES.map((t) => ({ value: t, label: t }))
  const filtered = assets.filter(
    (a) => assetTypeFilter === '全部' || a.type === assetTypeFilter,
  )

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
        <h3>素材列表</h3>
        <div className="studio-head-actions">
          <FancySelect
            kicker="素材分类"
            value={assetTypeFilter}
            onChange={setAssetTypeFilter}
            options={assetTypeOptions}
            className="fancy-select-compact"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy === 'asset'}
            onClick={addAsset}
          >
            + 新增素材
          </button>
        </div>
      </div>
      <p className="muted">
        结构化角色、地点与设定备忘。完整知识库请进入项目「知识库」管理。
      </p>

      {loading ? (
        <p className="muted">加载中…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">暂无素材，点击上方按钮添加。</p>
      ) : (
        <ul className="studio-list studio-list-detailed">
          {filtered.map((a) => (
            <li key={a.id}>
              <div>
                {editingAssetId === a.id ? (
                  <div className="studio-asset-edit-form">
                    <input
                      className="input"
                      value={assetForm.name}
                      onChange={(e) => setAssetForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="素材名称"
                    />
                    <SelectField
                      label="素材类型"
                      value={assetForm.type}
                      onChange={(v) => setAssetForm((prev) => ({ ...prev, type: v }))}
                      options={ASSET_TYPES.filter((t) => t !== '全部').map((t) => ({
                        value: t,
                        label: t,
                      }))}
                    />
                    <textarea
                      className="input"
                      rows={2}
                      value={assetForm.note}
                      onChange={(e) => setAssetForm((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="素材描述"
                    />
                  </div>
                ) : (
                  <>
                    <strong>{a.name}</strong>
                    <p className="muted">{a.note}</p>
                  </>
                )}
              </div>
              <div className="studio-row-actions">
                <StatusBadge variant="neutral">{a.type}</StatusBadge>
                {editingAssetId === a.id ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy === `asset-edit:${a.id}`}
                      onClick={saveAssetEdit}
                    >
                      保存
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEditAsset}>
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => beginEditAsset(a)}
                  >
                    编辑
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy === `asset:${a.id}`}
                  onClick={() => removeAsset(a.id)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
