export default function WorkspaceOnboarding({
  unit,
  onImport,
  onNewManuscript,
  onFocusChat,
  onShowDiagnosis,
  outlineCount = 0,
  onOpenOutline,
  compact = false,
}) {
  return (
    <div className={`workspace-onboarding ${compact ? 'workspace-onboarding-compact' : ''}`}>
      {!compact && (
        <div className="workspace-onboarding-icon" aria-hidden="true">
          📖
        </div>
      )}
      <h3 className="workspace-onboarding-title">
        {compact ? `暂无${unit}` : '开始你的第一部文稿'}
      </h3>
      <p className="workspace-onboarding-desc">
        {compact
          ? '导入已有稿件，或新建一章开始写作'
          : '导入 docx 可快速起步；从零写可先和右侧 AI 聊清方向再落笔'}
      </p>
      {outlineCount > 0 && onOpenOutline && (
        <p className="workspace-onboarding-outline-hint">
          大纲目录已有 {outlineCount} 个文件（AI 可能已写入）。
          <button type="button" className="chat-inline-link" onClick={onOpenOutline}>
            打开大纲
          </button>
        </p>
      )}
      <div className="workspace-onboarding-actions">
        <button type="button" className="btn btn-primary" onClick={onImport}>
          导入 docx
        </button>
        <button type="button" className="btn btn-secondary" onClick={onNewManuscript}>
          新建{unit}
        </button>
      </div>
      <button type="button" className="workspace-onboarding-chat" onClick={onFocusChat}>
        或先和 AI 聊创作方向 →
      </button>
      {onShowDiagnosis && (
        <button type="button" className="workspace-onboarding-diagnosis" onClick={onShowDiagnosis}>
          项目诊断：查看导入与结构建议
        </button>
      )}
    </div>
  )
}
