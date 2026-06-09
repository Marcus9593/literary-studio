/** 轻量 Markdown → HTML（预览 / 对话用） */

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineFormat(s) {
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

export function renderSimpleMarkdown(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const out = []
  let inBlockquote = false
  let inCode = false

  for (let line of lines) {
    if (line.startsWith('```')) {
      if (inBlockquote) {
        out.push('</blockquote>')
        inBlockquote = false
      }
      if (!inCode) {
        inCode = true
        const lang = line.slice(3).trim()
        out.push(`<pre class="md-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>`)
      } else {
        inCode = false
        out.push('</code></pre>')
      }
      continue
    }

    if (inCode) {
      out.push(`${escapeHtml(line)}\n`)
      continue
    }

    if (line.startsWith('> ')) {
      if (!inBlockquote) {
        out.push('<blockquote>')
        inBlockquote = true
      }
      out.push(`<p>${inlineFormat(escapeHtml(line.slice(2)))}</p>`)
      continue
    }
    if (inBlockquote) {
      out.push('</blockquote>')
      inBlockquote = false
    }

    if (/^[-*]\s+/.test(line)) {
      out.push(`<p class="md-list-item">• ${inlineFormat(escapeHtml(line.replace(/^[-*]\s+/, '')))}</p>`)
      continue
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length
      const tag = `h${Math.min(level, 3)}`
      out.push(`<${tag}>${inlineFormat(escapeHtml(line.replace(/^#+\s*/, '')))}</${tag}>`)
      continue
    }

    if (line.trim() === '') {
      out.push('<br />')
      continue
    }

    out.push(`<p>${inlineFormat(escapeHtml(line))}</p>`)
  }

  if (inBlockquote) out.push('</blockquote>')
  if (inCode) out.push('</code></pre>')
  return out.join('\n')
}
