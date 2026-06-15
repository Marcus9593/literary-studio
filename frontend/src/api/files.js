import { authHeaders } from '../auth/token.js';
import { API, request } from './client.js';

export const getJob = (jobId) => request(`/jobs/${jobId}`)

/** 支持 zip / docx / pdf / md / txt 等，后端自动转为 Markdown */
export async function uploadProjectFile(projectId, file, subdir = '正文') {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(
    `${API}/projects/${projectId}/upload?subdir=${encodeURIComponent(subdir)}`,
    { method: 'POST', body: form, headers: authHeaders() },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = err.detail
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg || d).join('; ')
      : detail || err.error || err.message || `上传失败 (${res.status})`
    throw new Error(msg)
  }
  return res.json()
}

export const getExportFormats = () => request('/export/formats')

/** 触发浏览器下载（二进制或文本附件） */
export async function triggerDownload(apiPath, suggestedFilename = '') {
  let res
  try {
    res = await fetch(`${API}${apiPath}`, { headers: authHeaders() })
  } catch (err) {
    const msg = String(err?.message || '')
    if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new Error('无法连接服务器，请确认已运行 ./start.sh')
    }
    throw err
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.error || err.detail || err.message || `导出失败 ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedFilename || ''
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
