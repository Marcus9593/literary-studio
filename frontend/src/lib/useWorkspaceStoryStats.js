import { useEffect, useRef, useState } from 'react'
import { getStoryHealth, getStoryKnowledge, getTodaySuggestions, listStoryPlans } from '../api.js'

const EMPTY = { knowledge: '暂无', plansPending: 0, health: '暂无', suggestions: '暂无', loading: true }

function countKbEntities(kb) {
  if (!kb || typeof kb !== 'object') return 0
  const keys = ['characters', 'relationships', 'foreshadows', 'timeline', 'locations']
  return keys.reduce((sum, k) => {
    const v = kb[k]
    if (Array.isArray(v)) return sum + v.length
    return sum
  }, 0)
}

export function useWorkspaceStoryStats(projectId, { onError } = {}) {
  const [stats, setStats] = useState(EMPTY)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    if (!projectId) return undefined
    let cancelled = false
    setStats((s) => ({ ...s, loading: true }))
    const errors = []

    Promise.all([
      getStoryKnowledge(projectId).catch((e) => { errors.push(e); return null }),
      listStoryPlans(projectId).catch((e) => { errors.push(e); return { plans: [] } }),
      getStoryHealth(projectId).catch((e) => { errors.push(e); return null }),
      getTodaySuggestions(projectId, 3).catch((e) => { errors.push(e); return { suggestions: [] } }),
    ]).then(([kb, plansRes, health, today]) => {
      if (cancelled) return
      const kbCount = countKbEntities(kb)
      const kbFromHealth = health?.kb_stats
        ? Object.values(health.kb_stats).reduce((a, b) => a + (Number(b) || 0), 0)
        : 0
      const entityTotal = Math.max(kbCount, kbFromHealth)

      const pending = (plansRes?.plans || []).filter(
        (p) => p.status === 'pending_confirm' || p.status === 'executing',
      ).length

      const score = health?.overall_health
      const hasScore = score != null && score !== '' && score !== '—'

      const suggestionCount = (today?.suggestions || []).length

      setStats({
        knowledge: entityTotal > 0 ? `${entityTotal} 条` : '暂无',
        plansPending: pending,
        health: hasScore ? String(score) : entityTotal > 0 ? '待评估' : '暂无',
        suggestions: suggestionCount > 0 ? `${suggestionCount} 条` : '暂无',
        loading: false,
      })
      if (errors.length && onErrorRef.current) {
        onErrorRef.current(errors[0]?.message || '加载导航统计失败')
      }
    })

    return () => {
      cancelled = true
    }
  }, [projectId])

  return stats
}
