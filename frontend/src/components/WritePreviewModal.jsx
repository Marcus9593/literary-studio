import Modal from './Modal.jsx'
import { diffStats, lineDiff } from '../lib/simpleDiff.js'

export default function WritePreviewModal({
  open,
  onClose,
  preview,
  onOpenNew,
  onReplace,
  onApplyInline,
}) {
  if (!open || !preview) return null

  const { title, filename, oldContent, newContent, isSameFile, inline } = preview
  const hasOld = Boolean(oldContent?.trim())

  if (inline) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="行内 AI 预览"
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={onApplyInline}>
              替换选中文字
            </button>
          </>
        )}
      >
        <div className="inline-edit-modal">
          <p className="muted write-preview-hint">
            左右对比原文与 AI 结果，确认后替换选区。
          </p>
          <div className="inline-compare-columns">
            <div className="inline-compare-col">
              <h4>原文</h4>
              <pre className="inline-compare-text">{oldContent}</pre>
            </div>
            <div className="inline-compare-col inline-compare-col-new">
              <h4>AI 结果</h4>
              <pre className="inline-compare-text">{newContent}</pre>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  const rows = lineDiff(oldContent, newContent)
  const stats = diffStats(rows)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 生成结果预览"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            暂不处理
          </button>
          {isSameFile && hasOld && (
            <button type="button" className="btn btn-secondary" onClick={onReplace}>
              替换当前文稿
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onOpenNew}>
            {isSameFile ? '保留并查看' : '打开新稿'}
          </button>
        </>
      }
    >
      <p className="write-preview-meta">
        <strong>{title || filename}</strong>
        <span className="muted">
          {' '}· 约 {newContent.replace(/\s/g, '').length} 字
          {stats.added + stats.changed + stats.removed > 0 && (
            <> · +{stats.added} 行 / ~{stats.changed} 改 / -{stats.removed} 行</>
          )}
        </span>
      </p>
      <p className="muted write-preview-hint">
        {isSameFile
          ? '新内容已保存到项目目录；编辑器可能仍是旧版，请预览后选择「替换」或「保留并查看」。'
          : '新稿已保存到项目目录，可先预览再决定是否打开。'}
      </p>
      <div className="write-preview-diff">
        {rows.slice(0, 200).map((row, i) => (
          <div key={i} className={`diff-line diff-line-${row.type}`}>
            {row.type === 'remove' && <span className="diff-old">{row.oldLine || ' '}</span>}
            {row.type === 'add' && <span className="diff-new">{row.newLine || ' '}</span>}
            {row.type === 'change' && (
              <>
                <span className="diff-old">{row.oldLine}</span>
                <span className="diff-new">{row.newLine}</span>
              </>
            )}
            {row.type === 'same' && (
              <span className="diff-same">{row.newLine || ' '}</span>
            )}
          </div>
        ))}
        {rows.length > 200 && (
          <p className="muted" style={{ padding: 8 }}>… 仅显示前 200 行</p>
        )}
      </div>
    </Modal>
  )
}
