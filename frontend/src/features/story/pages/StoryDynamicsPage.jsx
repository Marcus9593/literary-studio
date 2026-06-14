import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, getStoryUnderstanding } from '../../../api.js'
import StoryOsPage from '../../../components/StoryOsPage.jsx'
import { useToast } from '../../../components/Toast.jsx'

/* ── 情绪类型颜色映射 ── */
const EMOTION_COLORS = {
  愤怒: '#ff4d4f',
  悲伤: '#597ef7',
  恐惧: '#722ed1',
  喜悦: '#52c41a',
  惊讶: '#faad14',
  期待: '#13c2c2',
  绝望: '#2f2f2f',
  释然: '#95de64',
  紧张: '#ff7a45',
  厌恶: '#a0d911',
  平静: '#bfbfbf',
}

const VALUE_COLORS = {
  positive: '#52c41a',
  negative: '#ff4d4f',
  neutral: '#1890ff',
}

const INTENSITY_LABELS = ['', '轻微', '明显', '强烈', '爆发']

/* ── SVG 折线图组件 ── */

function LineChart({ data, width = 800, height = 280, onHover }) {
  const padding = { top: 30, right: 30, bottom: 50, left: 50 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  if (!data.length) return <p className="muted" style={{ textAlign: 'center' }}>暂无数据</p>

  const maxY = 4
  const stepX = chartW / Math.max(data.length - 1, 1)

  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - ((d.max_intensity || 1) / maxY) * chartH,
    ...d,
  }))

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const areaD = pathD
    + ` L ${points[points.length - 1].x} ${padding.top + chartH}`
    + ` L ${points[0].x} ${padding.top + chartH} Z`

  // Y 轴刻度
  const yTicks = [1, 2, 3, 4]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* 网格线 */}
      {yTicks.map((v) => {
        const y = padding.top + chartH - (v / maxY) * chartH
        return (
          <g key={v}>
            <line x1={padding.left} y1={y} x2={padding.left + chartW} y2={y}
              stroke="#f0f0f0" strokeWidth="1" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end"
              fontSize="11" fill="#999">{INTENSITY_LABELS[v]}</text>
          </g>
        )
      })}

      {/* X 轴标签（每隔几章显示） */}
      {points.map((p, i) => {
        const showLabel = data.length <= 20 || i % Math.ceil(data.length / 20) === 0 || i === data.length - 1
        if (!showLabel) return null
        return (
          <text key={i} x={p.x} y={height - 10} textAnchor="middle"
            fontSize="10" fill="#999">
            {p.chapter}
          </text>
        )
      })}

      {/* 面积填充 */}
      <path d={areaD} fill="rgba(24,144,255,0.08)" />

      {/* 折线 */}
      <path d={pathD} fill="none" stroke="#1890ff" strokeWidth="2" />

      {/* 数据点 */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill={p.max_intensity >= 4 ? '#ff4d4f' : p.max_intensity >= 3 ? '#fa8c16' : '#1890ff'}
          stroke="#fff"
          strokeWidth="1.5"
          onMouseEnter={() => onHover?.(p)}
          onMouseLeave={() => onHover?.(null)}
          style={{ cursor: 'pointer' }}
        />
      ))}

      {/* Y 轴标题 */}
      <text x={12} y={padding.top + chartH / 2} textAnchor="middle"
        fontSize="11" fill="#666" transform={`rotate(-90, 12, ${padding.top + chartH / 2})`}>
        情感强度
      </text>
    </svg>
  )
}

/* ── 堆叠柱状图（情绪类型分布） ── */

function StackedBarChart({ curveData, width = 800, height = 260 }) {
  const padding = { top: 20, right: 30, bottom: 50, left: 50 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  if (!curveData.length) return null

  // 收集所有出现过的情绪类型
  const allEmotions = new Set()
  curveData.forEach((d) => {
    d.emotions?.forEach((e) => allEmotions.add(e.type))
  })
  const emotionTypes = [...allEmotions]

  const barW = Math.max(4, (chartW / curveData.length) - 2)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* 图例 */}
      {emotionTypes.map((type, i) => (
        <g key={type} transform={`translate(${padding.left + i * 80}, 8)`}>
          <rect width="10" height="10" rx="2" fill={EMOTION_COLORS[type] || '#bfbfbf'} />
          <text x="14" y="9" fontSize="10" fill="#666">{type}</text>
        </g>
      ))}

      {/* 柱状图 */}
      {curveData.map((d, i) => {
        const x = padding.left + i * (chartW / curveData.length) + 1
        let yOffset = padding.top + chartH

        return (
          <g key={i}>
            {(d.emotions || []).map((e, j) => {
              const barH = (e.intensity / 4) * chartH
              yOffset -= barH
              return (
                <rect
                  key={j}
                  x={x}
                  y={yOffset}
                  width={barW}
                  height={barH}
                  fill={EMOTION_COLORS[e.type] || '#bfbfbf'}
                  opacity={0.85}
                />
              )
            })}
            {/* X 轴标签 */}
            {(curveData.length <= 20 || i % Math.ceil(curveData.length / 20) === 0 || i === curveData.length - 1) && (
              <text x={x + barW / 2} y={height - 10} textAnchor="middle"
                fontSize="10" fill="#999">{d.chapter}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ── 情感疲劳告警 ── */

function FatigueWarnings({ warnings }) {
  if (!warnings?.length) return null

  return (
    <section className="card">
      <h3>情感疲劳告警</h3>
      <p className="hint">检测到以下可能引起读者疲劳的区间</p>
      <div className="fatigue-warnings">
        {warnings.map((w, i) => (
          <div key={i} className={`fatigue-item fatigue-${w.severity}`}>
            <div className="fatigue-header">
              <span className="fatigue-rule">{w.ruleId}</span>
              <span className="fatigue-name">{w.name}</span>
              <span className={`fatigue-severity severity-${w.severity}`}>
                {w.severity === 'high' ? '高' : '中'}
              </span>
            </div>
            <p className="fatigue-detail">{w.detail}</p>
            <p className="fatigue-range hint">
              第 {w.from} 章 - 第 {w.to} 章
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── 价值转变时间线 ── */

function ValueShiftTimeline({ curveData }) {
  const shifts = useMemo(
    () => curveData.filter((d) => d.value_shift).map((d) => d.value_shift),
    [curveData],
  )

  if (!shifts.length) return null

  return (
    <section className="card">
      <h3>价值转变时间线</h3>
      <p className="hint">角色核心信念/立场的关键转变节点</p>
      <div className="value-shift-timeline">
        {shifts.map((s, i) => (
          <div key={i} className="value-shift-item">
            <span
              className="value-shift-dot"
              style={{ background: VALUE_COLORS[s.direction] || '#1890ff' }}
            />
            <div className="value-shift-content">
              <strong>第 {s.chapter} 章</strong>
              <span className="value-shift-label">{s.label}</span>
              <p className="hint">{s.trigger}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── 主页面 ── */

export default function StoryDynamicsPage() {
  const { projectId } = useParams()
  const showToast = useToast()
  const [project, setProject] = useState(null)
  const [understanding, setUnderstanding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoveredPoint, setHoveredPoint] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getProject(projectId),
      getStoryUnderstanding(projectId).catch(() => null),
    ])
      .then(([p, u]) => {
        setProject(p)
        setUnderstanding(u)
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, showToast])

  useEffect(() => { load() }, [load])

  const emotionCurve = understanding?.emotion_curve
  const curveData = emotionCurve?.curve || []
  const fatigueWarnings = emotionCurve?.fatigue_warnings || []
  const summary = emotionCurve?.summary || {}

  // 价值转变数据（从 understanding 的 value_shifts 或 emotion_curve 中获取）
  const valueShifts = understanding?.value_shifts

  return (
    <StoryOsPage
      className="story-dynamics-page"
      projectTitle={project?.title}
      loading={loading}
      loadingLabel="加载故事动力数据…"
    >
      <header className="page-header story-page-intro">
        <h2>故事动力</h2>
        <p className="hint">{project?.title} -- 情感曲线可视化与疲劳检测</p>
      </header>

      {/* 概览卡片 */}
      {summary.chapter_count > 0 && (
        <section className="card dynamics-overview">
          <div className="dynamics-stats">
            <div className="stat-item">
              <span className="stat-value">{summary.chapter_count}</span>
              <span className="stat-label">分析章节</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{summary.avg_intensity?.toFixed(1)}</span>
              <span className="stat-label">平均强度</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{summary.peak_intensity || '-'}</span>
              <span className="stat-label">峰值强度</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{summary.value_shifts || 0}</span>
              <span className="stat-label">价值转变</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: fatigueWarnings.length ? '#ff4d4f' : '#52c41a' }}>
                {fatigueWarnings.length}
              </span>
              <span className="stat-label">疲劳告警</span>
            </div>
          </div>
        </section>
      )}

      {/* 情感强度折线图 */}
      <section className="card">
        <h3>情感强度曲线</h3>
        <p className="hint">X 轴为章节序号，Y 轴为情感强度等级（1-4 级）</p>

        {/* 悬浮提示 */}
        {hoveredPoint && (
          <div className="dynamics-tooltip">
            <strong>第 {hoveredPoint.chapter} 章</strong>
            <span> | 主导情绪：{hoveredPoint.dominant_emotion} | 强度：{hoveredPoint.max_intensity} 级</span>
            {hoveredPoint.filename && <span> | {hoveredPoint.filename}</span>}
          </div>
        )}

        <LineChart data={curveData} onHover={setHoveredPoint} />

        {/* 疲劳区间标红 */}
        {fatigueWarnings.filter((w) => w.ruleId === 'FATIGUE_01' || w.ruleId === 'FATIGUE_05').length > 0 && (
          <p className="dynamics-warning-hint">
            图中红色数据点表示 4 级情感爆发章节，连续出现时会触发疲劳告警
          </p>
        )}
      </section>

      {/* 情绪类型堆叠图 */}
      <section className="card">
        <h3>情绪类型分布</h3>
        <p className="hint">不同颜色代表不同情绪类型，堆叠高度反映强度</p>
        <StackedBarChart curveData={curveData} />
      </section>

      {/* 情感疲劳告警 */}
      <FatigueWarnings warnings={fatigueWarnings} />

      {/* 价值转变时间线 */}
      <ValueShiftTimeline curveData={curveData} />

      {/* 情绪分布饼图（文字版） */}
      {summary.emotion_distribution && Object.keys(summary.emotion_distribution).length > 0 && (
        <section className="card">
          <h3>主导情绪统计</h3>
          <div className="emotion-distribution">
            {Object.entries(summary.emotion_distribution)
              .sort((a, b) => b[1] - a[1])
              .map(([emotion, count]) => (
                <div key={emotion} className="emotion-dist-item">
                  <span
                    className="emotion-dist-dot"
                    style={{ background: EMOTION_COLORS[emotion] || '#bfbfbf' }}
                  />
                  <span className="emotion-dist-name">{emotion}</span>
                  <div className="emotion-dist-bar-wrap">
                    <div
                      className="emotion-dist-bar"
                      style={{
                        width: `${(count / summary.chapter_count) * 100}%`,
                        background: EMOTION_COLORS[emotion] || '#bfbfbf',
                      }}
                    />
                  </div>
                  <span className="emotion-dist-count">{count} 章</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 无数据提示 */}
      {!loading && curveData.length === 0 && (
        <section className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: 8 }}>暂无情感曲线数据</p>
          <p className="hint">请先运行"全书理解"同步，系统将自动分析各章节的情感状态</p>
        </section>
      )}
    </StoryOsPage>
  )
}
