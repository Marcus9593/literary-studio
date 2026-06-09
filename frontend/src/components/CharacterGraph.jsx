import { useEffect, useRef, useState } from 'react'

const EDGE_COLORS = {
  trust: '#10b981',
  love: '#eb2f96',
  rivalry: '#fa8c16',
  mentor: '#1890ff',
  enemy: '#ff4d4f',
  family: '#722ed1',
  related: '#8c8c8c',
}

export default function CharacterGraph({ data }) {
  const canvasRef = useRef(null)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    if (!data?.nodes?.length) {
      setNodes([])
      setEdges([])
      return
    }
    const ns = data.nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(data.nodes.length, 1)
      const r = 140
      return { ...n, x: 300 + r * Math.cos(angle), y: 240 + r * Math.sin(angle), vx: 0, vy: 0 }
    })
    setNodes(ns)
    setEdges(data.edges || [])
  }, [data])

  useEffect(() => {
    if (!canvasRef.current || !nodes.length) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    let frame = 0
    let animNodes = [...nodes]

    const simulate = () => {
      const ns = animNodes.map((n) => ({ ...n }))
      const k = 0.01
      const repulsion = 5000

      for (let i = 0; i < ns.length; i += 1) {
        for (let j = i + 1; j < ns.length; j += 1) {
          let dx = ns[j].x - ns[i].x
          let dy = ns[j].y - ns[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = repulsion / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          ns[i].vx -= fx
          ns[i].vy -= fy
          ns[j].vx += fx
          ns[j].vy += fy
        }
      }

      for (const e of edges) {
        const src = ns.find((n) => n.id === e.source)
        const tgt = ns.find((n) => n.id === e.target)
        if (!src || !tgt) continue
        const dx = tgt.x - src.x
        const dy = tgt.y - src.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = k * (dist - 120)
        src.vx += (dx / dist) * force
        src.vy += (dy / dist) * force
        tgt.vx -= (dx / dist) * force
        tgt.vy -= (dy / dist) * force
      }

      for (const n of ns) {
        n.vx += (W / 2 - n.x) * 0.001
        n.vy += (H / 2 - n.y) * 0.001
        n.vx *= 0.9
        n.vy *= 0.9
        n.x += n.vx
        n.y += n.vy
        n.x = Math.max(40, Math.min(W - 40, n.x))
        n.y = Math.max(40, Math.min(H - 40, n.y))
      }
      return ns
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const e of edges) {
        const src = animNodes.find((n) => n.id === e.source)
        const tgt = animNodes.find((n) => n.id === e.target)
        if (!src || !tgt) continue
        ctx.beginPath()
        ctx.moveTo(src.x, src.y)
        ctx.lineTo(tgt.x, tgt.y)
        ctx.strokeStyle = EDGE_COLORS[e.type] || EDGE_COLORS.related
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      for (const n of animNodes) {
        const r = hovered === n.id ? 22 : 18
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = hovered === n.id ? 'var(--accent, #6366f1)' : 'var(--surface-2, #e8e8f0)'
        ctx.fill()
        ctx.strokeStyle = 'var(--border, #ccc)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = 'var(--text, #222)'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(n.name?.slice(0, 6) || '?', n.x, n.y + 4)
      }
    }

    const tick = () => {
      if (frame < 60) {
        animNodes = simulate()
        frame += 1
      }
      draw()
      raf = requestAnimationFrame(tick)
    }
    let raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [nodes, edges, hovered])

  const onMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hit = nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 20)
    setHovered(hit?.id || null)
  }

  if (!data?.nodes?.length) {
    return <p className="muted">暂无角色关系数据，请先在知识库添加人物与关系。</p>
  }

  return (
    <div className="character-graph-wrap">
      <canvas
        ref={canvasRef}
        width={600}
        height={480}
        className="character-graph-canvas"
        onMouseMove={onMove}
        onMouseLeave={() => setHovered(null)}
      />
      {hovered && (
        <div className="character-graph-tooltip">
          {nodes.find((n) => n.id === hovered)?.name}
        </div>
      )}
    </div>
  )
}
