import { useEffect, useState } from 'react'
import { listProjects } from '../../../api.js'

/** 需要选定项目的功能模块：共享项目列表与选中态 */
export function useProjectScope(showToast) {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listProjects()
      .then((ps) => {
        setProjects(ps || [])
        setSelectedProjectId(ps?.[0]?.id || '')
      })
      .catch((err) => showToast?.(err.message || '加载项目列表失败', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.title,
    meta: `${(p.stats?.total_words || 0).toLocaleString()} 字 · ${p.stats?.manuscript_count || 0} 稿`,
  }))

  return {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    projectOptions,
    loading,
  }
}
