import { useEffect, useMemo, useState } from 'react'
import { useDashboardContext } from '../App.jsx'
import { fetchEmotionCurve } from '../api.js'
import ChartWrapper from '../components/ChartWrapper.jsx'

/* ── 情绪类型颜色映射 ── */
const EMOTION_COLORS = {
    愤怒: '#d7263d',
    悲伤: '#597ef7',
    恐惧: '#7f5af0',
    喜悦: '#2ec27e',
    惊讶: '#f5a524',
    期待: '#00b8d4',
    绝望: '#2a220f',
    释然: '#95de64',
    紧张: '#ff5c8a',
    厌恶: '#a0d911',
    平静: '#bfbfbf',
}

const VALUE_COLORS = {
    positive: '#2ec27e',
    negative: '#d7263d',
    neutral: '#26a8ff',
}

const SEVERITY_LABEL = { high: '高', medium: '中' }

/* ── 情感强度折线图 option ── */

function buildEmotionLineOption(curveData, fatigueWarnings) {
    const chapters = curveData.map(d => d.chapter)
    const intensities = curveData.map(d => d.max_intensity || 1)
    const emotions = curveData.map(d => d.dominant_emotion || '平静')

    // 标记疲劳区间（连续3+章同强度 → 标红）
    const fatigueRanges = (fatigueWarnings || [])
        .filter(w => w.ruleId === 'FATIGUE_01' || w.ruleId === 'FATIGUE_05')
        .map(w => {
            const fromIdx = chapters.indexOf(w.from)
            const toIdx = chapters.indexOf(w.to)
            return { fromIdx, toIdx }
        })
        .filter(r => r.fromIdx >= 0 && r.toIdx >= 0)

    const markAreaData = fatigueRanges.map(r => [
        { xAxis: r.fromIdx, itemStyle: { color: 'rgba(215,38,61,0.08)' } },
        { xAxis: r.toIdx },
    ])

    return {
        tooltip: {
            trigger: 'axis',
            formatter(params) {
                const p = params[0]
                const idx = p.dataIndex
                const ch = chapters[idx]
                const emo = emotions[idx]
                const level = intensities[idx]
                return `<strong>第 ${ch} 章</strong><br/>主导情绪：${emo}<br/>强度：${level} 级`
            },
        },
        xAxis: {
            type: 'category',
            data: chapters,
            axisLabel: {
                interval: chapters.length > 30 ? Math.floor(chapters.length / 15) : 0,
                formatter: v => `${v}`,
            },
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 4,
            interval: 1,
            axisLabel: {
                formatter: v => ['', '轻微', '明显', '强烈', '爆发'][v] || '',
            },
        },
        series: [
            {
                type: 'line',
                data: intensities,
                symbol: 'circle',
                symbolSize: 8,
                lineStyle: { width: 3, color: '#26a8ff' },
                itemStyle: {
                    color(params) {
                        const v = params.value
                        if (v >= 4) return '#d7263d'
                        if (v >= 3) return '#f5a524'
                        return '#26a8ff'
                    },
                    borderColor: '#fff',
                    borderWidth: 2,
                },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(38,168,255,0.2)' },
                            { offset: 1, color: 'rgba(38,168,255,0)' },
                        ],
                    },
                },
                markLine: {
                    silent: true,
                    data: [
                        { yAxis: 3, lineStyle: { color: '#f5a524', type: 'dashed' }, label: { formatter: '强烈阈值' } },
                    ],
                },
                ...(markAreaData.length ? { markArea: { data: markAreaData, silent: true } } : {}),
            },
        ],
    }
}

/* ── 情绪类型堆叠图 option ── */

function buildEmotionStackOption(curveData) {
    if (!curveData.length) return null

    const allEmotions = new Set()
    curveData.forEach(d => (d.emotions || []).forEach(e => allEmotions.add(e.type)))
    const emotionTypes = [...allEmotions]
    const chapters = curveData.map(d => d.chapter)

    const series = emotionTypes.map(type => ({
        name: type,
        type: 'bar',
        stack: 'emotions',
        barWidth: '60%',
        data: curveData.map(d => {
            const found = (d.emotions || []).find(e => e.type === type)
            return found ? found.intensity : 0
        }),
        itemStyle: { color: EMOTION_COLORS[type] || '#bfbfbf' },
    }))

    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
        },
        legend: {
            data: emotionTypes,
            bottom: 0,
        },
        xAxis: {
            type: 'category',
            data: chapters,
            axisLabel: {
                interval: chapters.length > 30 ? Math.floor(chapters.length / 15) : 0,
                formatter: v => `${v}`,
            },
        },
        yAxis: {
            type: 'value',
            max: 4,
            interval: 1,
            axisLabel: {
                formatter: v => ['', '轻微', '明显', '强烈', '爆发'][v] || '',
            },
        },
        series,
    }
}

/* ── 价值转变时间线 option ── */

function buildValueShiftOption(curveData) {
    const shifts = curveData
        .filter(d => d.value_shift)
        .map(d => d.value_shift)

    if (!shifts.length) return null

    const data = shifts.map(s => ({
        value: [s.chapter, 0],
        label: s.label,
        direction: s.direction,
        trigger: s.trigger,
    }))

    return {
        tooltip: {
            formatter(params) {
                const d = params.data
                return `<strong>第 ${d.value[0]} 章</strong><br/>${d.label}<br/>${d.trigger || ''}`
            },
        },
        xAxis: {
            type: 'value',
            min: 1,
            max: curveData.length || 10,
            name: '章节',
            axisLabel: { formatter: v => `${v}` },
        },
        yAxis: { show: false },
        series: [
            {
                type: 'scatter',
                data,
                symbolSize: 18,
                symbol: 'diamond',
                itemStyle: {
                    color(params) {
                        return VALUE_COLORS[params.data.direction] || '#26a8ff'
                    },
                    borderColor: '#fff',
                    borderWidth: 2,
                },
                label: {
                    show: true,
                    formatter: '{@label}',
                    position: 'top',
                    fontSize: 11,
                    color: '#2a220f',
                },
            },
        ],
    }
}

/* ── 主页面 ── */

export default function StoryDynamicsPage() {
    const { refreshToken } = useDashboardContext()
    const [emotionCurve, setEmotionCurve] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetchEmotionCurve()
            .then(data => setEmotionCurve(data))
            .catch(() => setEmotionCurve(null))
            .finally(() => setLoading(false))
    }, [refreshToken])

    const curveData = emotionCurve?.curve || []
    const fatigueWarnings = emotionCurve?.fatigue_warnings || []
    const summary = emotionCurve?.summary || {}

    const lineOption = useMemo(
        () => (curveData.length ? buildEmotionLineOption(curveData, fatigueWarnings) : null),
        [curveData, fatigueWarnings],
    )

    const stackOption = useMemo(
        () => buildEmotionStackOption(curveData),
        [curveData],
    )

    const valueShiftOption = useMemo(
        () => buildValueShiftOption(curveData),
        [curveData],
    )

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-card">
                    <div className="section-label">LOADING</div>
                    <p>正在加载情感曲线数据…</p>
                </div>
            </div>
        )
    }

    if (!curveData.length) {
        return (
            <div className="page-container">
                <h2 className="page-title">故事动力</h2>
                <div className="loading-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ fontSize: '1.1rem', marginBottom: 8 }}>暂无情感曲线数据</p>
                    <p className="hint">请先运行"全书理解"同步，系统将自动分析各章节的情感状态</p>
                </div>
            </div>
        )
    }

    return (
        <div className="page-container">
            <h2 className="page-title">故事动力</h2>

            {/* 概览统计 */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-number">{summary.chapter_count || 0}</div>
                    <div className="stat-label">分析章节</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{summary.avg_intensity?.toFixed(1) || '-'}</div>
                    <div className="stat-label">平均强度</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{summary.peak_intensity || '-'}</div>
                    <div className="stat-label">峰值强度</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{summary.value_shifts || 0}</div>
                    <div className="stat-label">价值转变</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number" style={{ color: fatigueWarnings.length ? '#d7263d' : '#2ec27e' }}>
                        {fatigueWarnings.length}
                    </div>
                    <div className="stat-label">疲劳告警</div>
                </div>
            </div>

            {/* 情感强度折线图 */}
            {lineOption && (
                <section className="panel">
                    <h3 className="section-label">情感强度曲线</h3>
                    <p className="hint">X 轴为章节序号，Y 轴为情感强度等级（1-4 级）· 红色区域为疲劳告警区间</p>
                    <ChartWrapper option={lineOption} height={360} />
                </section>
            )}

            {/* 情绪类型堆叠图 */}
            {stackOption && (
                <section className="panel">
                    <h3 className="section-label">情绪类型分布</h3>
                    <p className="hint">不同颜色代表不同情绪类型，堆叠高度反映强度</p>
                    <ChartWrapper option={stackOption} height={320} />
                </section>
            )}

            {/* 价值转变时间线 */}
            {valueShiftOption && (
                <section className="panel">
                    <h3 className="section-label">价值转变时间线</h3>
                    <p className="hint">绿色=正向转变 · 红色=负向转变 · 蓝色=认知转变</p>
                    <ChartWrapper option={valueShiftOption} height={200} />
                </section>
            )}

            {/* 情感疲劳告警 */}
            {fatigueWarnings.length > 0 && (
                <section className="panel">
                    <h3 className="section-label">情感疲劳告警</h3>
                    <div className="foreshadow-list">
                        {fatigueWarnings.map((w, i) => (
                            <div key={i} className={`foreshadow-item urgency-${w.severity === 'high' ? 'overdue' : 'urgent'}`}>
                                <div className="foreshadow-header">
                                    <span className="foreshadow-id">{w.ruleId}</span>
                                    <span className="foreshadow-name">{w.name}</span>
                                    <span className={`badge ${w.severity === 'high' ? 'badge-danger' : 'badge-warn'}`}>
                                        {SEVERITY_LABEL[w.severity] || w.severity}
                                    </span>
                                </div>
                                <p className="foreshadow-desc">{w.detail}</p>
                                <p className="foreshadow-hint">第 {w.from} 章 - 第 {w.to} 章</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 情绪分布统计 */}
            {summary.emotion_distribution && Object.keys(summary.emotion_distribution).length > 0 && (
                <section className="panel">
                    <h3 className="section-label">主导情绪统计</h3>
                    <div className="entity-grid">
                        {Object.entries(summary.emotion_distribution)
                            .sort((a, b) => b[1] - a[1])
                            .map(([emotion, count]) => (
                                <div key={emotion} className="entity-card">
                                    <span
                                        className="entity-dot"
                                        style={{ background: EMOTION_COLORS[emotion] || '#bfbfbf' }}
                                    />
                                    <div className="entity-info">
                                        <div className="entity-name">{emotion}</div>
                                        <div className="entity-meta">{count} 章 · 占比 {Math.round((count / summary.chapter_count) * 100)}%</div>
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        maxWidth: 120,
                                        height: 8,
                                        background: '#e8dcc4',
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            width: `${(count / summary.chapter_count) * 100}%`,
                                            height: '100%',
                                            background: EMOTION_COLORS[emotion] || '#bfbfbf',
                                            borderRadius: 4,
                                        }} />
                                    </div>
                                </div>
                            ))}
                    </div>
                </section>
            )}
        </div>
    )
}
