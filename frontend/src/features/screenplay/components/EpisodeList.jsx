import { useState } from 'react';
import EpisodeCard from './EpisodeCard.jsx';

export default function EpisodeList({
  screenplay,
  onAddEpisode,
  onEditEpisode,
  onDeleteEpisode,
  onAddScene,
  onEditScene,
  onDeleteScene,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', season: 1, timeline: 'present', end_hook: '' });
  const [expandedId, setExpandedId] = useState(null);

  const episodes = screenplay?.episodes || [];
  const storylines = screenplay?.storylines || [];
  const timelines = screenplay?.timelines || [];

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.title.trim()) return;
    await onAddEpisode?.(addForm);
    setAddForm({ title: '', season: 1, timeline: 'present', end_hook: '' });
    setShowAddForm(false);
  };

  return (
    <div className="episode-list">
      <div className="episode-list-toolbar">
        <h3>剧集管理</h3>
        <span className="episode-count">{episodes.length} 集</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>
          + 新增剧集
        </button>
      </div>

      {showAddForm && (
        <div className="episode-add-form card">
          <h4>新增剧集</h4>
          <form onSubmit={handleAddSubmit}>
            <input type="text" placeholder="剧集标题" value={addForm.title} onChange={e => setAddForm(p => ({ ...p, title: e.target.value }))} required />
            <div className="form-row-inline">
              <select value={addForm.season} onChange={e => setAddForm(p => ({ ...p, season: parseInt(e.target.value) }))}>
                <option value={1}>第1季</option>
              </select>
              <select value={addForm.timeline} onChange={e => setAddForm(p => ({ ...p, timeline: e.target.value }))}>
                {timelines.map(tl => <option key={tl.id} value={tl.id}>{tl.label}</option>)}
              </select>
            </div>
            <input type="text" placeholder="结尾钩子（可选）" value={addForm.end_hook} onChange={e => setAddForm(p => ({ ...p, end_hook: e.target.value }))} />
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>取消</button>
              <button type="submit" className="btn btn-primary">添加</button>
            </div>
          </form>
        </div>
      )}

      <div className="episode-cards">
        {episodes.map(ep => (
          <EpisodeCard
            key={ep.id}
            episode={ep}
            storylines={storylines}
            timelines={timelines}
            expanded={expandedId === ep.id}
            onToggle={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
            onEdit={onEditEpisode}
            onDelete={onDeleteEpisode}
            onAddScene={onAddScene}
            onEditScene={onEditScene}
            onDeleteScene={onDeleteScene}
          />
        ))}
        {episodes.length === 0 && (
          <div className="episode-empty">暂无剧集，点击上方按钮添加</div>
        )}
      </div>
    </div>
  );
}
