/**
 * 解析大纲 Markdown 为树（见 docs/outline-markdown-spec.md）
 */
export function parseOutlineMarkdown(text) {
  const lines = String(text || '').split('\n')
  const root = { title: '大纲', children: [], level: 0 }
  const stack = [{ level: 0, node: root }]

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line.trim())
    if (heading) {
      const level = heading[1].length
      const node = { title: heading[2].trim(), children: [], level, synopsis: '' }
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop()
      stack[stack.length - 1].node.children.push(node)
      stack.push({ level, node })
      continue
    }
    const synopsis = /^>\s*梗概[：:]\s*(.+)$/.exec(line.trim())
    if (synopsis && stack.length > 1) {
      stack[stack.length - 1].node.synopsis = synopsis[1].trim()
      continue
    }
    if (stack.length > 1 && line.trim() && !line.trim().startsWith('#') && !stack[stack.length - 1].node.synopsis) {
      const parent = stack[stack.length - 1].node
      if (!parent.synopsis && !line.trim().startsWith('-') && !line.trim().startsWith('|')) {
        parent.synopsis = line.trim()
      }
    }
  }

  return root.children
}

export function flattenOutlineNodes(nodes, depth = 0) {
  const out = []
  for (const n of nodes || []) {
    out.push({ ...n, depth })
    out.push(...flattenOutlineNodes(n.children, depth + 1))
  }
  return out
}

/** 按标题路径更新梗概并回写 Markdown */
export function updateSynopsisInMarkdown(text, titlePath, newSynopsis) {
  const lines = String(text || '').split('\n')
  const target = titlePath[titlePath.length - 1]
  if (!target) return text

  let depth = 0
  let matchIdx = -1
  let headingLevel = 0

  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.+)$/.exec(lines[i].trim())
    if (!m) continue
    const level = m[1].length
    const title = m[2].trim()
    if (title === target && level > depth) {
      depth = level
      matchIdx = i
      headingLevel = level
    }
  }

  if (matchIdx < 0) return text

  let end = matchIdx + 1
  while (end < lines.length) {
    const hm = /^(#{1,6})\s+/.exec(lines[end].trim())
    if (hm && hm[1].length <= headingLevel) break
    end += 1
  }

  const before = lines.slice(0, matchIdx + 1)
  const after = lines.slice(end)
  const synopsisLines = newSynopsis.trim()
    ? [`> 梗概：${newSynopsis.trim()}`]
    : []

  return [...before, ...synopsisLines, ...after].join('\n')
}

function cloneOutlineNodes(nodes) {
  return (nodes || []).map((n) => ({
    ...n,
    children: cloneOutlineNodes(n.children),
  }))
}

function getSiblingsContainer(tree, parentPath) {
  if (!parentPath?.length) return { siblings: tree, ok: true }
  let current = tree
  for (let i = 0; i < parentPath.length; i += 1) {
    const title = parentPath[i]
    const node = current.find((n) => n.title === title)
    if (!node) return { siblings: null, ok: false }
    if (i === parentPath.length - 1) return { siblings: node.children, ok: true }
    current = node.children || []
  }
  return { siblings: null, ok: false }
}

/** 同级节点拖拽调序（parentPath 为空表示根级） */
export function reorderOutlineSiblings(nodes, parentPath, fromIndex, toIndex) {
  const tree = cloneOutlineNodes(nodes)
  const { siblings, ok } = getSiblingsContainer(tree, parentPath || [])
  if (!ok || !siblings) return nodes
  if (fromIndex === toIndex) return tree
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= siblings.length || toIndex >= siblings.length) {
    return tree
  }
  const [item] = siblings.splice(fromIndex, 1)
  siblings.splice(toIndex, 0, item)
  return tree
}

export function serializeOutlineNode(node) {
  const level = Math.min(6, Math.max(1, node.level || 1))
  const lines = [`${'#'.repeat(level)} ${node.title}`]
  if (node.synopsis?.trim()) {
    lines.push(`> 梗概：${node.synopsis.trim()}`)
  }
  for (const child of node.children || []) {
    lines.push('')
    lines.push(serializeOutlineNode(child))
  }
  return lines.join('\n')
}

/** 树结构序列化为 Markdown（拖拽/调序后回写） */
export function serializeOutlineTree(nodes) {
  const body = (nodes || []).map(serializeOutlineNode).join('\n\n').trim()
  return body ? `${body}\n` : ''
}
