/** 行级 diff，用于生成预览 */

export function lineDiff(oldText = '', newText = '') {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const rows = []
  const maxLen = Math.max(oldLines.length, newLines.length)

  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i]
    const n = newLines[i]
    if (o === undefined) {
      rows.push({ type: 'add', oldLine: '', newLine: n })
    } else if (n === undefined) {
      rows.push({ type: 'remove', oldLine: o, newLine: '' })
    } else if (o === n) {
      rows.push({ type: 'same', oldLine: o, newLine: n })
    } else {
      rows.push({ type: 'change', oldLine: o, newLine: n })
    }
  }
  return rows
}

export function diffStats(rows) {
  let added = 0
  let removed = 0
  let changed = 0
  for (const r of rows) {
    if (r.type === 'add') added++
    else if (r.type === 'remove') removed++
    else if (r.type === 'change') changed++
  }
  return { added, removed, changed }
}
