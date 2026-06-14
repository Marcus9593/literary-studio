import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardContext } from '../App.jsx'
import {
    fetchEntities,
    fetchRelationships,
    fetchRelationshipEvents,
    fetchStateChanges,
    fetchStoryEvents,
} from '../api.js'
import Badge from '../components/Badge.jsx'
import ChartWrapper from '../components/ChartWrapper.jsx'
import DataTable from '../components/DataTable.jsx'
import { formatChapterLabel, formatJSONText } from '../lib/format.js'
import { getLatestChapter } from '../lib/story.js'

const TYPE_COLORS = {
    角色: '#26a8ff',
    势力: '#7f5af0',
    地点: '#2ec27e',
    法宝: '#f5a524',
}

const CATEGORY_NAMES = ['角色', '势力', '地点', '其他']

// 弧光阶段常量
const ARC_STAGES = [
    { index: 0, name: '谎言', name_en: 'lie', color: '#ef4444' },
    { index: 1, name: '欲望', name_en: 'want', color: '#f97316' },
    { index: 2, name: '冲突', name_en: 'friction', color: '#eab308' },
    { index: 3, name: '危机', name_en: 'crisis', color: '#a855f7' },
    { index: 4, name: '高潮抉择', name_en: 'climax', color: '#3b82f6' },
    { index: 5, name: '新平衡', name_en: 'equilibrium', color: '#22c55e' },
]

const ARC_TYPE_LABELS = {
    positive: { label: '正向', color: '#22c55e', tone: 'green' },
    negative: { label: '负向', color: '#ef4444', tone: 'red' },
    flat: { label: '平坦', color: '#6b7280', tone: 'neutral' },
    corruption: { label: '堕落', color: '#a855f7', tone: 'purple' },
    mixed: { label: '混合', color: '#f5a524', tone: 'amber' },
}

function parsePositiveChapter(value) {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
}

function resolveCategory(type) {
    if (type === '角色') return '角色'
    if (type === '势力') return '势力'
    if (type === '地点') return '地点'
    return '其他'
}

// ---------------------------------------------------------------------------
// 弧光分析引擎（前端侧，基于 story_events 推断）
// ---------------------------------------------------------------------------

function extractArcElements(entity) {
    const currentJson = entity.current_json || {}
    const desc = entity.desc || ''
    const notes = currentJson.notes || currentJson

    return {
        lie: notes.lie || notes.false_belief || null,
        want: notes.want || notes.desire || notes.goal || null,
        need: notes.need || notes.requirement || null,
        fatal_flaw: notes.fatal_flaw || notes.flaw || notes.weakness || null,
    }
}

function inferArcStageFromEvents(events, entityName) {
    const name = entityName.toLowerCase()
    const arcEvents = events
        .filter((e) => {
            const subject = (e.subject || '').toLowerCase()
            return subject.includes(name) || name.includes(subject)
        })
        .sort((a, b) => (a.chapter || 0) - (b.chapter || 0))

    let stageIndex = 0
    let arcType = 'positive'
    const timeline = []

    for (const event of arcEvents) {
        if (event.event_type === 'arc_stage_changed') {
            const payload = event.payload || {}
            if (typeof payload.to_stage === 'number') stageIndex = payload.to_stage
            if (payload.arc_type) arcType = payload.arc_type
            timeline.push({ chapter: event.chapter, type: 'stage_changed', desc: payload.description || `阶段变更` })
        } else if (event.event_type === 'lie_challenged') {
            if (stageIndex < 3) stageIndex = 3
            timeline.push({ chapter: event.chapter, type: 'lie_challenged', desc: event.payload?.description || '谎言被挑战' })
        } else if (event.event_type === 'truth_discovered') {
            const accepted = event.payload?.accepted !== false
            if (stageIndex < 4) stageIndex = 4
            arcType = accepted ? 'positive' : 'negative'
            timeline.push({ chapter: event.chapter, type: 'truth_discovered', desc: event.payload?.description || '真相被发现' })
        } else if (event.event_type === 'character_state_changed') {
            timeline.push({ chapter: event.chapter, type: 'state_changed', desc: event.payload?.description || '状态变化' })
        }
    }

    return { stageIndex, arcType, timeline, eventCount: arcEvents.length }
}

function buildArcData(entity, storyEvents) {
    const elements = extractArcElements(entity)
    const { stageIndex, arcType, timeline, eventCount } = inferArcStageFromEvents(storyEvents, entity.canonical_name || entity.id)

    // 如果没有从事件中推断到足够信息，使用启发式
    let inferredStage = stageIndex
    if (eventCount === 0 && entity.first_appearance) {
        const chapterRange = (entity.last_appearance || 0) - (entity.first_appearance || 0)
        if (chapterRange > 30) inferredStage = 3
        else if (chapterRange > 15) inferredStage = 2
        else if (chapterRange > 5) inferredStage = 1
        else inferredStage = 0
    }

    const stages = ARC_STAGES.map((s) => ({
        ...s,
        status: s.index < inferredStage ? 'completed' : s.index === inferredStage ? 'active' : 'pending',
    }))

    return {
        character_id: entity.id,
        name: entity.canonical_name || entity.id,
        arc_type: arcType,
        current_stage_index: inferredStage,
        stages,
        fatal_flaw: elements.fatal_flaw,
        lie: elements.lie,
        want: elements.want,
        need: elements.need,
        timeline,
        confidence: eventCount > 0 ? Math.min(0.95, 0.6 + eventCount * 0.07) : 0.45,
    }
}

// ---------------------------------------------------------------------------
// 关系图谱构建
// ---------------------------------------------------------------------------

function buildGraphData(entities, relationships, events, currentChapter) {
    const eventRows = [...events]
        .filter(row => (parsePositiveChapter(row.chapter) || 0) <= currentChapter)
        .sort((left, right) => (parsePositiveChapter(left.chapter) || 0) - (parsePositiveChapter(right.chapter) || 0))

    const latestEventByPair = new Map()
    for (const row of eventRows) {
        if (!row?.from_entity || !row?.to_entity) continue
        latestEventByPair.set(`${row.from_entity}|${row.to_entity}`, row)
    }

    const baseRelationships = [...relationships]
        .filter(row => (parsePositiveChapter(row.chapter) || 0) <= currentChapter)
        .sort((left, right) => (parsePositiveChapter(left.chapter) || 0) - (parsePositiveChapter(right.chapter) || 0))

    const linkMap = new Map()
    for (const row of baseRelationships) {
        if (!row?.from_entity || !row?.to_entity) continue
        const key = `${row.from_entity}|${row.to_entity}`
        linkMap.set(key, row)
    }
    for (const [key, row] of latestEventByPair.entries()) {
        linkMap.set(key, row)
    }

    const visibleEntityMap = new Map()
    for (const entity of entities) {
        const firstAppearance = parsePositiveChapter(entity?.first_appearance)
        if (!firstAppearance || firstAppearance <= currentChapter) {
            visibleEntityMap.set(entity.id, entity)
        }
    }

    for (const row of linkMap.values()) {
        const fromEntity = entities.find(entity => entity.id === row.from_entity)
        const toEntity = entities.find(entity => entity.id === row.to_entity)
        if (fromEntity) visibleEntityMap.set(fromEntity.id, fromEntity)
        if (toEntity) visibleEntityMap.set(toEntity.id, toEntity)
    }

    const nodes = [...visibleEntityMap.values()].map(entity => {
        const category = resolveCategory(entity.type)
        return {
            id: entity.id,
            name: entity.canonical_name || entity.id,
            value: entity.tier || '',
            category: CATEGORY_NAMES.indexOf(category),
            symbolSize: entity.is_protagonist ? 34 : entity.tier === 'S' ? 30 : entity.tier === 'A' ? 26 : 22,
            itemStyle: {
                color: entity.is_protagonist ? '#f5a524' : TYPE_COLORS[category] || '#00b8d4',
                borderColor: '#2a220f',
                borderWidth: 2,
            },
            label: {
                show: true,
                color: '#2a220f',
                fontSize: 11,
                fontWeight: 600,
            },
            type: entity.type,
            firstAppearance: entity.first_appearance,
        }
    })

    const links = [...linkMap.values()]
        .filter(row => visibleEntityMap.has(row.from_entity) && visibleEntityMap.has(row.to_entity))
        .map(row => ({
            source: row.from_entity,
            target: row.to_entity,
            name: row.description || row.event_type || row.type || '关联',
            lineStyle: {
                color: '#8f7f5c',
                width: 2,
                curveness: 0.1,
            },
            label: {
                show: true,
                color: '#5d5035',
                fontSize: 11,
            },
        }))

    return { nodes, links }
}

function buildGraphOption(data) {
    return {
        tooltip: {
            formatter: params => {
                if (params.dataType === 'edge') {
                    return params.data?.name || '关系'
                }
                return `${params.data?.name || '实体'}<br/>${params.data?.type || '未知类型'}`
            },
        },
        legend: {
            bottom: 0,
            data: CATEGORY_NAMES,
        },
        series: [
            {
                type: 'graph',
                layout: 'force',
                roam: true,
                symbol: 'rect',
                animationDuration: 300,
                animationEasingUpdate: 'cubicOut',
                categories: CATEGORY_NAMES.map(name => ({
                    name,
                    itemStyle: { color: TYPE_COLORS[name] || '#00b8d4' },
                })),
                force: {
                    repulsion: 360,
                    edgeLength: [120, 200],
                    gravity: 0.08,
                },
                lineStyle: {
                    color: '#8f7f5c',
                    width: 2,
                    curveness: 0.1,
                },
                edgeLabel: {
                    show: true,
                    formatter: params => params.data?.name || '',
                    color: '#5d5035',
                    fontSize: 11,
                },
                emphasis: {
                    focus: 'adjacency',
                    label: { show: true },
                },
                data: data.nodes,
                links: data.links,
            },
        ],
    }
}

// ---------------------------------------------------------------------------
// 弧光追踪子组件
// ---------------------------------------------------------------------------

function ArcProgressBar({ stages, currentIndex }) {
    return (
        <div className="arc-progress-bar">
            {stages.map((stage, i) => (
                <div
                    key={stage.index}
                    className={`arc-stage ${stage.status}`}
                    title={`${stage.name}（${stage.status === 'completed' ? '已完成' : stage.status === 'active' ? '进行中' : '待开始'}）`}
                >
                    <div
                        className="arc-stage-dot"
                        style={{
                            backgroundColor: stage.status === 'completed'
                                ? stage.color
                                : stage.status === 'active'
                                    ? stage.color
                                    : '#374151',
                            boxShadow: stage.status === 'active' ? `0 0 8px ${stage.color}` : 'none',
                        }}
                    />
                    <span className="arc-stage-label">{stage.name}</span>
                    {i < stages.length - 1 && (
                        <div
                            className="arc-stage-connector"
                            style={{
                                backgroundColor: stage.status === 'completed' ? stage.color : '#374151',
                            }}
                        />
                    )}
                </div>
            ))}
        </div>
    )
}

function ArcTypeTag({ arcType }) {
    const info = ARC_TYPE_LABELS[arcType] || ARC_TYPE_LABELS.positive
    return <Badge tone={info.tone}>{info.label}弧光</Badge>
}

function ArcTimeline({ timeline }) {
    if (!timeline || timeline.length === 0) {
        return (
            <div className="arc-timeline-empty">
                <p className="arc-timeline-empty-text">暂无关键时刻记录</p>
            </div>
        )
    }

    const typeIcons = {
        stage_changed: '>>',
        lie_challenged: '!',
        truth_discovered: '*',
        state_changed: '~',
    }

    return (
        <div className="arc-timeline">
            {timeline.slice(0, 10).map((event, i) => (
                <div key={i} className="arc-timeline-item">
                    <div className="arc-timeline-dot" />
                    <div className="arc-timeline-content">
                        <span className="arc-timeline-chapter">
                            {event.chapter ? `第${event.chapter}章` : '待定'}
                        </span>
                        <span className="arc-timeline-type">{typeIcons[event.type] || '-'}</span>
                        <span className="arc-timeline-desc">{event.desc}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}

function ArcDetailPanel({ arcData }) {
    if (!arcData) return null

    const currentStage = ARC_STAGES[arcData.current_stage_index] || ARC_STAGES[0]

    return (
        <div className="arc-detail-panel">
            <div className="arc-detail-header">
                <div className="arc-detail-title">
                    <span className="arc-detail-name">{arcData.name}</span>
                    <ArcTypeTag arcType={arcData.arc_type} />
                </div>
                <div className="arc-detail-confidence">
                    <span className="confidence-label">置信度</span>
                    <span
                        className="confidence-value"
                        style={{
                            color: arcData.confidence >= 0.8 ? '#22c55e' : arcData.confidence >= 0.6 ? '#f5a524' : '#ef4444',
                        }}
                    >
                        {Math.round(arcData.confidence * 100)}%
                    </span>
                </div>
            </div>

            <ArcProgressBar stages={arcData.stages} currentIndex={arcData.current_stage_index} />

            <div className="arc-elements-grid">
                {arcData.fatal_flaw && (
                    <div className="arc-element">
                        <span className="arc-element-label">致命缺陷</span>
                        <span className="arc-element-value">{arcData.fatal_flaw}</span>
                    </div>
                )}
                {arcData.lie && (
                    <div className="arc-element">
                        <span className="arc-element-label">谎言</span>
                        <span className="arc-element-value">{arcData.lie}</span>
                    </div>
                )}
                {arcData.want && (
                    <div className="arc-element">
                        <span className="arc-element-label">欲望</span>
                        <span className="arc-element-value">{arcData.want}</span>
                    </div>
                )}
                {arcData.need && (
                    <div className="arc-element">
                        <span className="arc-element-label">需求</span>
                        <span className="arc-element-value">{arcData.need}</span>
                    </div>
                )}
            </div>

            <div className="arc-timeline-section">
                <div className="arc-timeline-header">
                    <span className="section-label">关键时刻</span>
                    <Badge tone="cyan">{arcData.timeline.length} 个事件</Badge>
                </div>
                <ArcTimeline timeline={arcData.timeline} />
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// 过滤器与列表组件
// ---------------------------------------------------------------------------

function TypeFilter({ types, value, onChange }) {
    return (
        <div className="filter-group">
            <button
                type="button"
                className={`filter-btn ${value === '' ? 'active' : ''}`.trim()}
                onClick={() => onChange('')}
            >
                全部
            </button>
            {types.map(type => (
                <button
                    key={type}
                    type="button"
                    className={`filter-btn ${value === type ? 'active' : ''}`.trim()}
                    onClick={() => onChange(type)}
                >
                    {type}
                </button>
            ))}
        </div>
    )
}

function EntityListTable({ rows, selectedId, onSelect, arcDataMap }) {
    if (!rows.length) {
        return (
            <div className="empty-state">
                <p>暂无实体数据</p>
            </div>
        )
    }

    return (
        <div className="table-wrap">
            <table className="data-table entity-table">
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>类型</th>
                        <th>层级</th>
                        <th>弧光</th>
                        <th>首现</th>
                        <th>末现</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(entity => {
                        const arc = arcDataMap?.get(entity.id)
                        const currentStage = arc ? ARC_STAGES[arc.current_stage_index] : null
                        return (
                            <tr
                                key={entity.id}
                                className={`entity-row ${selectedId === entity.id ? 'selected' : ''}`.trim()}
                                onClick={() => onSelect(entity)}
                            >
                                <td className={`entity-name ${entity.is_protagonist ? 'protagonist' : ''}`.trim()}>
                                    {entity.canonical_name}
                                </td>
                                <td>
                                    <Badge tone="blue">{entity.type || '未知'}</Badge>
                                </td>
                                <td>{entity.tier || '---'}</td>
                                <td>
                                    {currentStage ? (
                                        <span
                                            className="arc-mini-badge"
                                            style={{ color: currentStage.color }}
                                        >
                                            {currentStage.name}
                                        </span>
                                    ) : (
                                        <span className="arc-mini-badge arc-mini-empty">---</span>
                                    )}
                                </td>
                                <td>{formatChapterLabel(entity.first_appearance)}</td>
                                <td>{formatChapterLabel(entity.last_appearance)}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ---------------------------------------------------------------------------
// 主页面组件
// ---------------------------------------------------------------------------

export default function CharactersPage() {
    const { projectInfo, refreshToken } = useDashboardContext()
    const [tab, setTab] = useState('list')
    const [entities, setEntities] = useState([])
    const [relationships, setRelationships] = useState([])
    const [relationshipEvents, setRelationshipEvents] = useState([])
    const [storyEvents, setStoryEvents] = useState([])
    const [typeFilter, setTypeFilter] = useState('')
    const [selected, setSelected] = useState(null)
    const [changes, setChanges] = useState([])
    const [playing, setPlaying] = useState(false)
    const latestChapter = getLatestChapter(projectInfo)
    const [graphChapter, setGraphChapter] = useState(latestChapter)

    useEffect(() => {
        setGraphChapter(latestChapter)
    }, [latestChapter, refreshToken])

    useEffect(() => {
        let cancelled = false

        Promise.allSettled([
            fetchEntities(),
            fetchRelationships({ limit: 1000 }),
            fetchRelationshipEvents({ limit: 5000 }),
            fetchStoryEvents({ limit: 500 }),
        ]).then(results => {
            if (cancelled) return

            const entityRows = results[0].status === 'fulfilled' ? results[0].value : []
            setEntities(entityRows)
            setRelationships(results[1].status === 'fulfilled' ? results[1].value : [])
            setRelationshipEvents(results[2].status === 'fulfilled' ? results[2].value : [])
            setStoryEvents(results[3].status === 'fulfilled' ? results[3].value : [])

            if (entityRows.length) {
                setSelected(current => current || entityRows[0])
            }
        })

        return () => {
            cancelled = true
        }
    }, [refreshToken])

    useEffect(() => {
        if (!selected?.id) {
            setChanges([])
            return
        }

        let cancelled = false
        fetchStateChanges({ entity: selected.id, limit: 30 })
            .then(payload => {
                if (!cancelled) {
                    setChanges(payload)
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setChanges([])
                }
            })

        return () => {
            cancelled = true
        }
    }, [selected])

    const advanceGraphRef = useRef(null)
    advanceGraphRef.current = () => {
        setGraphChapter(current => {
            if (current >= latestChapter) {
                setPlaying(false)
                return latestChapter
            }
            return Math.min(latestChapter, current + 5)
        })
    }

    useEffect(() => {
        if (!playing) return undefined
        const timer = window.setInterval(() => advanceGraphRef.current(), 120)
        return () => window.clearInterval(timer)
    }, [playing])

    const types = useMemo(() => {
        return [...new Set(entities.map(entity => entity.type).filter(Boolean))].sort()
    }, [entities])

    const filteredEntities = useMemo(() => {
        return typeFilter ? entities.filter(entity => entity.type === typeFilter) : entities
    }, [entities, typeFilter])

    useEffect(() => {
        if (selected && filteredEntities.some(entity => entity.id === selected.id)) return
        setSelected(filteredEntities[0] || null)
    }, [filteredEntities, selected])

    const graphData = useMemo(() => {
        return buildGraphData(entities, relationships, relationshipEvents, graphChapter)
    }, [entities, graphChapter, relationshipEvents, relationships])

    // 构建角色弧光数据
    const characterEntities = useMemo(() => {
        return filteredEntities.filter((e) => e.type === '角色')
    }, [filteredEntities])

    const arcDataMap = useMemo(() => {
        const map = new Map()
        for (const entity of characterEntities) {
            map.set(entity.id, buildArcData(entity, storyEvents))
        }
        return map
    }, [characterEntities, storyEvents])

    const selectedArc = selected ? arcDataMap.get(selected.id) : null

    return (
        <section className="dashboard-page">
            <header className="page-header">
                <h2>角色图鉴</h2>
                <Badge tone="green">{filteredEntities.length} / {entities.length} 个实体</Badge>
            </header>

            <TypeFilter types={types} value={typeFilter} onChange={setTypeFilter} />

            <div className="tab-strip">
                <button
                    type="button"
                    className={`tab-btn ${tab === 'list' ? 'active' : ''}`.trim()}
                    onClick={() => setTab('list')}
                >
                    实体列表
                </button>
                <button
                    type="button"
                    className={`tab-btn ${tab === 'graph' ? 'active' : ''}`.trim()}
                    onClick={() => setTab('graph')}
                >
                    关系图谱
                </button>
                <button
                    type="button"
                    className={`tab-btn ${tab === 'arcs' ? 'active' : ''}`.trim()}
                    onClick={() => setTab('arcs')}
                >
                    弧光追踪
                </button>
            </div>

            {tab === 'list' ? (
                <div className="split-layout">
                    <div className="split-main">
                        <article className="card">
                            <div className="card-header">
                                <div>
                                    <div className="section-label">ENTITY INDEX</div>
                                    <div className="card-title">实体列表</div>
                                </div>
                                <Badge tone="cyan">{typeFilter || '全部类型'}</Badge>
                            </div>
                            <EntityListTable
                                rows={filteredEntities}
                                selectedId={selected?.id}
                                onSelect={setSelected}
                                arcDataMap={arcDataMap}
                            />
                        </article>
                    </div>

                    <div className="split-side">
                        <article className="card sticky-card">
                            <div className="card-header">
                                <div>
                                    <div className="section-label">ENTITY DETAIL</div>
                                    <div className="card-title">{selected?.canonical_name || '未选择实体'}</div>
                                </div>
                                {selected?.tier ? <Badge tone="purple">{selected.tier}</Badge> : null}
                            </div>
                            {selected ? (
                                <div className="entity-detail">
                                    <p><strong>类型：</strong>{selected.type || '未知'}</p>
                                    <p><strong>ID：</strong><code>{selected.id}</code></p>
                                    <p><strong>首现：</strong>{formatChapterLabel(selected.first_appearance)}</p>
                                    <p><strong>末现：</strong>{formatChapterLabel(selected.last_appearance)}</p>
                                    {selected.desc ? <p className="entity-desc">{selected.desc}</p> : null}
                                    {selected.current_json ? (
                                        <div className="entity-current-block">
                                            <div className="mini-label">当前状态</div>
                                            <pre className="code-block">{formatJSONText(selected.current_json)}</pre>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="empty-state compact">
                                    <p>从左侧选择一个实体查看详情</p>
                                </div>
                            )}

                            {/* 弧光迷你面板 */}
                            {selectedArc && (
                                <>
                                    <div className="detail-divider" />
                                    <div className="card-header compact-header">
                                        <div>
                                            <div className="section-label">CHARACTER ARC</div>
                                            <div className="card-title">弧光追踪</div>
                                        </div>
                                        <ArcTypeTag arcType={selectedArc.arc_type} />
                                    </div>
                                    <ArcProgressBar
                                        stages={selectedArc.stages}
                                        currentIndex={selectedArc.current_stage_index}
                                    />
                                    {selectedArc.fatal_flaw && (
                                        <p className="arc-mini-flaw">
                                            <strong>致命缺陷：</strong>{selectedArc.fatal_flaw}
                                        </p>
                                    )}
                                </>
                            )}

                            <div className="detail-divider" />

                            <div className="card-header compact-header">
                                <div>
                                    <div className="section-label">STATE CHANGES</div>
                                    <div className="card-title">状态变化历史</div>
                                </div>
                                <Badge tone="amber">{changes.length} 条</Badge>
                            </div>
                            <DataTable
                                columns={[
                                    {
                                        key: 'chapter',
                                        label: '章',
                                        render: row => formatChapterLabel(row.chapter),
                                    },
                                    { key: 'field', label: '字段' },
                                    {
                                        key: 'change',
                                        label: '变化',
                                        render: row => `${row.old_value ?? '---'} → ${row.new_value ?? '---'}`,
                                    },
                                ]}
                                rows={changes}
                                rowKey={(row, index) => `${row.entity_id || 'entity'}-${row.chapter || 0}-${index}`}
                                pageSize={6}
                                emptyText="暂无状态变化记录"
                                minWidth={420}
                            />
                        </article>
                    </div>
                </div>
            ) : tab === 'graph' ? (
                <article className="card">
                    <div className="card-header">
                        <div>
                            <div className="section-label">RELATION GRAPH</div>
                            <div className="card-title">关系图谱</div>
                        </div>
                        <Badge tone="blue">ECharts graph * 力导向 * 时间轴</Badge>
                    </div>

                    <div className="graph-toolbar">
                        <button
                            type="button"
                            className="page-btn icon-btn"
                            onClick={() => {
                                if (playing) {
                                    setPlaying(false)
                                    return
                                }
                                if (graphChapter >= latestChapter) {
                                    setGraphChapter(1)
                                }
                                setPlaying(true)
                            }}
                        >
                            {playing ? '暂停' : '播放'}
                        </button>
                        <span className="range-label">第 1 章</span>
                        <input
                            className="timeline-slider"
                            type="range"
                            min="1"
                            max={String(latestChapter)}
                            value={graphChapter}
                            onChange={event => {
                                const nextChapter = Number(event.target.value)
                                startTransition(() => {
                                    setGraphChapter(nextChapter)
                                })
                            }}
                        />
                        <span className="range-label">{formatChapterLabel(latestChapter)}</span>
                        <Badge tone="blue">{formatChapterLabel(graphChapter)}</Badge>
                        <Badge tone="green">{graphData.nodes.length} 节点</Badge>
                        <Badge tone="purple">{graphData.links.length} 关系</Badge>
                    </div>

                    {graphData.nodes.length ? (
                        <ChartWrapper
                            className="tall"
                            height={420}
                            option={buildGraphOption(graphData)}
                        />
                    ) : (
                        <div className="empty-state">
                            <p>当前章节窗口没有可视化关系</p>
                        </div>
                    )}
                </article>
            ) : (
                /* 弧光追踪 Tab */
                <div className="arc-tracking-layout">
                    {characterEntities.length === 0 ? (
                        <article className="card">
                            <div className="empty-state">
                                <p>暂无角色实体数据</p>
                            </div>
                        </article>
                    ) : (
                        <div className="arc-cards-grid">
                            {characterEntities.map(entity => {
                                const arc = arcDataMap.get(entity.id)
                                if (!arc) return null
                                const currentStage = ARC_STAGES[arc.current_stage_index] || ARC_STAGES[0]
                                return (
                                    <article key={entity.id} className="card arc-card">
                                        <div className="card-header">
                                            <div>
                                                <div className="section-label">CHARACTER ARC</div>
                                                <div className="card-title">
                                                    {entity.canonical_name}
                                                    {entity.is_protagonist ? (
                                                        <Badge tone="amber" className="protagonist-badge">主角</Badge>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="arc-card-badges">
                                                <ArcTypeTag arcType={arc.arc_type} />
                                                <span
                                                    className="arc-stage-indicator"
                                                    style={{ color: currentStage.color }}
                                                >
                                                    {currentStage.name}
                                                </span>
                                            </div>
                                        </div>

                                        <ArcProgressBar
                                            stages={arc.stages}
                                            currentIndex={arc.current_stage_index}
                                        />

                                        <div className="arc-card-body">
                                            {arc.fatal_flaw && (
                                                <div className="arc-card-field">
                                                    <span className="arc-card-field-label">致命缺陷</span>
                                                    <span className="arc-card-field-value">{arc.fatal_flaw}</span>
                                                </div>
                                            )}
                                            {arc.lie && (
                                                <div className="arc-card-field">
                                                    <span className="arc-card-field-label">谎言</span>
                                                    <span className="arc-card-field-value">{arc.lie}</span>
                                                </div>
                                            )}
                                            {arc.want && (
                                                <div className="arc-card-field">
                                                    <span className="arc-card-field-label">欲望</span>
                                                    <span className="arc-card-field-value">{arc.want}</span>
                                                </div>
                                            )}
                                            {arc.need && (
                                                <div className="arc-card-field">
                                                    <span className="arc-card-field-label">需求</span>
                                                    <span className="arc-card-field-value">{arc.need}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="arc-card-footer">
                                            <span className="arc-confidence">
                                                置信度{' '}
                                                <span
                                                    style={{
                                                        color: arc.confidence >= 0.8 ? '#22c55e' : arc.confidence >= 0.6 ? '#f5a524' : '#ef4444',
                                                    }}
                                                >
                                                    {Math.round(arc.confidence * 100)}%
                                                </span>
                                            </span>
                                            <span className="arc-event-count">
                                                {arc.timeline.length} 个关键时刻
                                            </span>
                                        </div>

                                        {arc.timeline.length > 0 && (
                                            <div className="arc-card-timeline">
                                                <ArcTimeline timeline={arc.timeline} />
                                            </div>
                                        )}
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}
