import { useMemo, useState } from 'react'
import ProviderLogo from './ProviderLogo'

const CATEGORY_LABELS = {
  cn_official: '国内官方',
  aggregator: '聚合网关',
  third_party: '第三方',
  cloud_provider: '云服务',
  other: '其他',
}

const CATEGORY_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'cn_official', label: '国内官方' },
  { key: 'aggregator', label: '聚合网关' },
  { key: 'third_party', label: '第三方' },
  { key: 'cloud_provider', label: '云服务' },
]

/** 常用厂商置顶，便于快速选择 */
const POPULAR_IDS = new Set([
  'DeepSeek',
  'Bailian',
  'Bailian For Coding',
  'Kimi',
  'Kimi For Coding',
  'Xiaomi MiMo Token Plan (China)',
  'Zhipu GLM',
  'OpenRouter',
  'MiniMax',
])

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return String(url || '').replace(/^https?:\/\//, '').split('/')[0]
  }
}

function PresetRow({ tpl, active, onSelect }) {
  const host = hostLabel(tpl.base_url)
  const category = CATEGORY_LABELS[tpl.category] || null

  return (
    <button
      type="button"
      className={`preset-picker-row${active ? ' is-active' : ''}`}
      onClick={() => onSelect(tpl)}
      title={tpl.base_url}
    >
      <span className="preset-picker-row-check" aria-hidden>
        {active ? '✓' : ''}
      </span>
      <ProviderLogo icon={tpl.icon} name={tpl.label} size={32} />
      <span className="preset-picker-row-main">
        <span className="preset-picker-row-title">
          <span className="preset-picker-row-name">{tpl.label}</span>
          {category && <span className="preset-picker-row-badge">{category}</span>}
        </span>
        <span className="preset-picker-row-meta">
          {tpl.model && <span className="preset-picker-row-model">{tpl.model}</span>}
          {tpl.model && host && <span className="preset-picker-row-dot">·</span>}
          {host && <span className="preset-picker-row-host">{host}</span>}
        </span>
      </span>
    </button>
  )
}

export default function PresetPicker({
  presets,
  catalogMeta,
  selectedId,
  onSelect,
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return presets.filter((tpl) => {
      if (category !== 'all' && tpl.category !== category) return false
      if (!q) return true
      return (
        tpl.label.toLowerCase().includes(q)
        || tpl.base_url.toLowerCase().includes(q)
        || (tpl.model && tpl.model.toLowerCase().includes(q))
      )
    })
  }, [presets, query, category])

  const { popular, rest } = useMemo(() => {
    const pop = []
    const other = []
    for (const tpl of filtered) {
      if (POPULAR_IDS.has(tpl.id)) pop.push(tpl)
      else other.push(tpl)
    }
    return { popular: pop, rest: other }
  }, [filtered])

  const showPopular = category === 'all' && !query.trim() && popular.length > 0

  return (
    <section className="preset-picker" aria-label="CC Switch 供应商预设">
      <div className="preset-picker-head">
        <div>
          <h4 className="preset-picker-title">选择供应商</h4>
          <p className="preset-picker-sub">
            与{' '}
            <a href="https://github.com/farion1231/cc-switch" target="_blank" rel="noreferrer">
              CC Switch
            </a>{' '}
            默认地址同步 · {presets.length} 个可用
            {catalogMeta?.synced_at && (
              <span className="muted">
                {' '}
                · {new Date(catalogMeta.synced_at).toLocaleDateString('zh-CN')}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="preset-picker-toolbar">
        <input
          type="search"
          className="preset-picker-search"
          placeholder="搜索厂商、模型或域名…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="preset-picker-filters" role="tablist" aria-label="供应商分类">
        {CATEGORY_FILTERS.map((f) => {
          const count = f.key === 'all'
            ? presets.length
            : presets.filter((p) => p.category === f.key).length
          if (f.key !== 'all' && count === 0) return null
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={category === f.key}
              className={`preset-picker-filter${category === f.key ? ' is-active' : ''}`}
              onClick={() => setCategory(f.key)}
            >
              {f.label}
              <span className="preset-picker-filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="preset-picker-list">
        {showPopular && (
          <>
            <div className="preset-picker-section-label">常用</div>
            {popular.map((tpl) => (
              <PresetRow
                key={`pop-${tpl.id}`}
                tpl={tpl}
                active={selectedId === tpl.id}
                onSelect={onSelect}
              />
            ))}
            {rest.length > 0 && <div className="preset-picker-section-label">更多</div>}
          </>
        )}
        {(showPopular ? rest : filtered).map((tpl) => (
          <PresetRow
            key={tpl.id}
            tpl={tpl}
            active={selectedId === tpl.id}
            onSelect={onSelect}
          />
        ))}
        {!filtered.length && (
          <p className="preset-picker-empty muted">没有匹配的供应商，请换个关键词或分类。</p>
        )}
      </div>
    </section>
  )
}
