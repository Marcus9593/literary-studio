import { useState } from 'react';

export default function EpisodeCard({
  episode,
  storylines,
  timelines,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddScene,
  onEditScene,
  onDeleteScene,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [addSceneForm, setAddSceneForm] = useState({ int_ext: 'INT', location: '', time_of_day: '日', storyline: 'main', synopsis: '' });
  const [showAddScene, setShowAddScene] = useState(false);

  const scenes = episode.scenes || [];
  const timeline = timelines?.find(tl => tl.id === episode.timeline);

  const handleAddScene = async (e) => {
    e.preventDefault();
    if (!addSceneForm.location.trim()) return;
    await onAddScene?.(episode.id, addSceneForm);
    setAddSceneForm({ int_ext: 'INT', location: '', time_of_day: '日', storyline: 'main', synopsis: '' });
    setShowAddScene(false);
  };

  return (
    <div className={`episode-card card ${expanded ? 'expanded' : ''}`}>
      <div className="episode-card-header" onClick={onToggle}>
        <div className="episode-card-title-row">
          <span className="episode-number">E{String(episode.number).padStart(2, '0')}</span>
          <h4 className="episode-title">{episode.title}</h4>
          {timeline && <span className="episode-timeline-badge">{timeline.label}</span>}
          <span className="episode-scene-count">{scenes.length} 场</span>
        </div>
        {episode.end_hook && (
          <div className="episode-hook">🪝 {episode.end_hook}</div>
        )}
        <div className="episode-card-actions">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            ⋯
          </button>
          {showMenu && (
            <div className="episode-menu" onClick={e => e.stopPropagation()}>
              <button onClick={() => { onEdit?.(episode.id, { title: prompt('标题', episode.title) || episode.title }); setShowMenu(false); }}>编辑</button>
              <button className="danger" onClick={() => { onDelete?.(episode.id); setShowMenu(false); }}>删除</button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="episode-card-body">
          <div className="episode-scenes-header">
            <span>场景列表</span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowAddScene(true)}>
              + 添加场景
            </button>
          </div>

          {showAddScene && (
            <form onSubmit={handleAddScene} className="episode-add-scene-form">
              <div className="form-row-inline">
                <select value={addSceneForm.int_ext} onChange={e => setAddSceneForm(p => ({ ...p, int_ext: e.target.value }))}>
                  <option value="INT">INT</option>
                  <option value="EXT">EXT</option>
                </select>
                <input type="text" placeholder="地点" value={addSceneForm.location} onChange={e => setAddSceneForm(p => ({ ...p, location: e.target.value }))} required />
                <select value={addSceneForm.time_of_day} onChange={e => setAddSceneForm(p => ({ ...p, time_of_day: e.target.value }))}>
                  <option value="日">日</option>
                  <option value="夜">夜</option>
                </select>
                <button type="submit" className="btn btn-primary btn-xs">添加</button>
              </div>
            </form>
          )}

          <div className="episode-scenes-list">
            {scenes.map(sc => (
              <div key={sc.id} className="episode-scene-item">
                <span className="episode-scene-int">{sc.int_ext}</span>
                <span className="episode-scene-loc">{sc.location}</span>
                <span className="episode-scene-time">{sc.time_of_day}</span>
                {sc.synopsis && <span className="episode-scene-syn">{sc.synopsis}</span>}
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => onDeleteScene?.(episode.id, sc.id)}>×</button>
              </div>
            ))}
            {scenes.length === 0 && <div className="episode-scenes-empty">暂无场景</div>}
          </div>
        </div>
      )}
    </div>
  );
}
