export default function HomeBatchBar({
  selectedCount,
  visibleCount,
  onSelectAll,
  onClearSelection,
  onDelete,
  onExit,
}) {
  return (
    <div className="home-batch-bar" role="toolbar" aria-label="批量删除">
      <span className="home-batch-summary">
        已选 <strong>{selectedCount}</strong> / {visibleCount}，将永久删除
      </span>
      <div className="home-batch-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSelectAll}>
          全选
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClearSelection}
          disabled={selectedCount === 0}
        >
          取消选择
        </button>
        <button
          type="button"
          className="btn btn-sm project-delete-confirm"
          onClick={onDelete}
          disabled={selectedCount === 0}
        >
          删除所选
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
          完成
        </button>
      </div>
    </div>
  )
}
