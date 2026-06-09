import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../../api.js'

function fmt(n) {
  return (n || 0).toLocaleString()
}

export default function CockpitPanel({ showToast }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then((d) => setData(d || null))
      .catch((err) => showToast(err.message || '加载看板数据失败', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const summary = data?.summary
  const projects = data?.projects || []
  const trend = data?.activity_7d || []
  const staleProjects = data?.stale_projects || []
  const maxTrendWords = Math.max(1, ...trend.map((d) => d.words_updated || 0))

  return (
    <section className="studio-panel dashboard-panel">
      <div className="studio-metrics dashboard-metrics">
        <article className="studio-metric-card">
          <span>项目总数</span>
          <strong>{summary?.projects_count ?? '—'}</strong>
        </article>
        <article className="studio-metric-card">
          <span>今日活跃项目</span>
          <strong>{summary?.projects_active_today ?? '—'}</strong>
        </article>
        <article className="studio-metric-card">
          <span>今日改稿章节</span>
          <strong>{summary?.today_chapters_updated ?? '—'}</strong>
        </article>
        <article className="studio-metric-card">
          <span>今日改动字数</span>
          <strong>{loading ? '…' : fmt(summary?.today_words_updated)}</strong>
        </article>
        <article className="studio-metric-card">
          <span>累计字数</span>
          <strong>{loading ? '…' : fmt(summary?.total_words)}</strong>
        </article>
      </div>

      <div className="studio-block">
        <h3>近 7 日改稿趋势</h3>
        <p className="muted dashboard-hint">
          {data?._legacy
            ? '当前后端为旧版本，今日改稿统计不可用。请重启 ./start.sh 以加载最新后端。'
            : '按文稿文件最后保存时间统计；柱高为当日改动章节涉及的字数合计。'}
        </p>
        <div className="dashboard-trend-chart">
          {trend.map((d) => (
            <div
              key={d.date}
              className="dashboard-trend-col"
              title={`${d.label}：${d.chapters_updated} 章 · ${fmt(d.words_updated)} 字 · ${d.projects_active} 个项目`}
            >
              <div
                className="dashboard-trend-bar"
                style={{ height: `${Math.max(6, ((d.words_updated || 0) / maxTrendWords) * 96)}px` }}
              />
              <span className="dashboard-trend-meta">{d.chapters_updated}章</span>
              <span className="dashboard-trend-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {staleProjects.length > 0 && (
        <div className="studio-block dashboard-stale-block">
          <h3>久未更新项目</h3>
          <p className="muted dashboard-hint">超过 14 天未改稿的非归档项目</p>
          <ul className="dashboard-stale-list">
            {staleProjects.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}/health`} className="dashboard-project-link">
                  {p.title}
                </Link>
                <span className="muted">{p.days_since_update} 天未更新</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="studio-block">
        <div className="studio-block-head">
          <h3>各项目今日改稿</h3>
          <span className="muted">{data?.date ? `统计日 ${data.date}` : ''}</span>
        </div>

        {loading ? (
          <p className="muted">加载中…</p>
        ) : projects.length === 0 ? (
          <p className="muted">还没有项目，请先在<Link to="/projects">项目库</Link>创建。</p>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>今日改章</th>
                  <th>今日改动字数</th>
                  <th>累计章节</th>
                  <th>累计字数</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className={p.today_chapters_updated > 0 ? 'dashboard-row-active' : ''}>
                    <td>
                      <Link to={`/projects/${p.id}`} className="dashboard-project-link">
                        {p.title}
                      </Link>
                      {p.archived && <span className="dashboard-tag muted">已归档</span>}
                    </td>
                    <td>{p.today_chapters_updated > 0 ? p.today_chapters_updated : '—'}</td>
                    <td>{p.today_words_updated > 0 ? fmt(p.today_words_updated) : '—'}</td>
                    <td>{p.manuscript_count}</td>
                    <td>{fmt(p.total_words)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
