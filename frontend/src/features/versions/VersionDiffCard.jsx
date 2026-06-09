export default function VersionDiffCard({ versionDiff }) {
  if (!versionDiff) return null

  return (
    <div className="studio-diff-card">
      <h4>版本差异</h4>
      <p className="muted">
        变更 {versionDiff.counts.changed} / 新增 {versionDiff.counts.added} / 删除{' '}
        {versionDiff.counts.deleted}
      </p>
      {versionDiff.changed.slice(0, 5).map((item) => (
        <div key={`c-${item.path}`} className="studio-diff-row">
          <span>{item.path}</span>
          <span className="muted">
            {item.from_words} → {item.to_words} 字
          </span>
        </div>
      ))}
      {versionDiff.added.slice(0, 5).map((item) => (
        <div key={`a-${item.path}`} className="studio-diff-row">
          <span>{item.path}</span>
          <span className="muted">新增</span>
        </div>
      ))}
      {versionDiff.deleted.slice(0, 5).map((item) => (
        <div key={`d-${item.path}`} className="studio-diff-row">
          <span>{item.path}</span>
          <span className="muted">删除</span>
        </div>
      ))}
    </div>
  )
}
