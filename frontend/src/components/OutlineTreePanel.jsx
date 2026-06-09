import { useState } from 'react'
import {
  parseOutlineMarkdown,
  reorderOutlineSiblings,
  serializeOutlineTree,
  updateSynopsisInMarkdown,
} from '../lib/outlineParser.js'

function TreeNode({
  node,
  depth,
  titlePath,
  siblingIndex,
  parentPath,
  onContentChange,
  content,
}) {
  const path = [...titlePath, node.title]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.synopsis || '')
  const [dragOver, setDragOver] = useState(false)

  const saveSynopsis = () => {
    const next = updateSynopsisInMarkdown(content, path, draft)
    onContentChange?.(next)
    setEditing(false)
  }

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/x-outline-index', String(siblingIndex))
    e.dataTransfer.setData('application/x-outline-parent', JSON.stringify(parentPath || []))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const fromIndex = Number(e.dataTransfer.getData('application/x-outline-index'))
    const fromParent = JSON.parse(e.dataTransfer.getData('application/x-outline-parent') || '[]')
    if (Number.isNaN(fromIndex)) return
    if (JSON.stringify(fromParent) !== JSON.stringify(parentPath || [])) return
    if (fromIndex === siblingIndex) return
    const tree = parseOutlineMarkdown(content)
    const nextTree = reorderOutlineSiblings(tree, parentPath, fromIndex, siblingIndex)
    onContentChange?.(serializeOutlineTree(nextTree))
  }

  return (
    <li
      className={`outline-tree-node ${dragOver ? 'outline-tree-node-drag-over' : ''}`.trim()}
      style={{ paddingLeft: depth * 14 }}
      draggable={Boolean(onContentChange)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="outline-tree-head">
        {onContentChange && (
          <span className="outline-drag-handle" title="拖拽调序" aria-hidden="true">⋮⋮</span>
        )}
        <span className="outline-tree-title">{node.title}</span>
      </div>
      {editing ? (
        <div className="outline-synopsis-edit">
          <textarea
            className="input"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={saveSynopsis}>保存梗概</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>取消</button>
        </div>
      ) : (
        <div className="outline-synopsis-row">
          {node.synopsis ? (
            <p className="outline-tree-synopsis muted">{node.synopsis}</p>
          ) : (
            <p className="outline-tree-synopsis muted">（无梗概）</p>
          )}
          {onContentChange && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              编辑梗概
            </button>
          )}
        </div>
      )}
      {node.children?.length > 0 && (
        <ul>
          {node.children.map((child, i) => (
            <TreeNode
              key={`${child.title}-${i}`}
              node={child}
              depth={depth + 1}
              titlePath={path}
              siblingIndex={i}
              parentPath={path}
              onContentChange={onContentChange}
              content={content}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function OutlineTreePanel({ content, onSynopsisSave, onOutlineChange }) {
  const tree = parseOutlineMarkdown(content)
  const onContentChange = onOutlineChange || onSynopsisSave

  if (!tree.length) {
    return (
      <div className="outline-tree-panel muted">
        <p>使用 <code>## 第003章 标题</code> 格式编写大纲</p>
      </div>
    )
  }

  return (
    <div className="outline-tree-panel">
      <h4>大纲结构 · 拖拽调序 · 点击编辑梗概（回写 Markdown）</h4>
      <ul className="outline-tree-root">
        {tree.map((node, i) => (
          <TreeNode
            key={`${node.title}-${i}`}
            node={node}
            depth={0}
            titlePath={[]}
            siblingIndex={i}
            parentPath={[]}
            onContentChange={onContentChange}
            content={content}
          />
        ))}
      </ul>
    </div>
  )
}
