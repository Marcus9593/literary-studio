export default function CharacterStatsPanel({ characters, scenes }) {
  const charList = Object.entries(characters || {})
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.scene_count - a.scene_count);

  const totalScenes = (scenes || []).length;

  if (charList.length === 0) {
    return (
      <div className="character-stats-panel">
        <h3>角色出场统计</h3>
        <p className="muted">暂无角色数据。在场景中添加角色后自动统计。</p>
      </div>
    );
  }

  return (
    <div className="character-stats-panel">
      <h3>角色出场统计</h3>
      <div className="character-stats-list">
        {charList.map(ch => (
          <div key={ch.name} className="character-stat-item">
            <div className="character-stat-name">{ch.name}</div>
            <div className="character-stat-bar-wrap">
              <div
                className="character-stat-bar"
                style={{ width: `${totalScenes > 0 ? (ch.scene_count / totalScenes * 100) : 0}%` }}
              />
            </div>
            <div className="character-stat-count">{ch.scene_count} 场</div>
            {ch.acts?.length > 0 && (
              <div className="character-stat-acts">
                {ch.acts.map(act => (
                  <span key={act} className="act-badge">第{act}幕</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
