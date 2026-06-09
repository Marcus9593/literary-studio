import { useState } from 'react';

export default function ForeshadowTracker({ foreshadows, episodes, onAdd, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ content: '', planted_episode: '' });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.content.trim()) return;
    await onAdd?.(addForm);
    setAddForm({ content: '', planted_episode: '' });
    setShowAdd(false);
  };

  const handleResolve = async (fs) => {
    const epId = prompt('在哪一集回收？输入集ID（如 ep_s01e01）');
    if (!epId) return;
    await onUpdate?.(fs.id, { status: 'resolved', resolved_episode: epId });
  };

  const openFss = (foreshadows || []).filter(f => f.status === 'open');
  const resolvedFss = (foreshadows || []).filter(f => f.status === 'resolved');

  return (
    <div className="foreshadow-tracker">
      <div className="foreshadow-header">
        <h3>伏笔管理</h3>
        <span className="foreshadow-count">{openFss.length} 未收 / {foreshadows?.length || 0} 总计</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          + 埋伏笔
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="foreshadow-add-form card">
          <input type="text" placeholder="伏笔内容" value={addForm.content} onChange={e => setAddForm(p => ({ ...p, content: e.target.value }))} required />
          <select value={addForm.planted_episode} onChange={e => setAddForm(p => ({ ...p, planted_episode: e.target.value }))}>
            <option value="">选择埋设集数（可选）</option>
            {(episodes || []).map(ep => (
              <option key={ep.id} value={ep.id}>E{String(ep.number).padStart(2, '0')} {ep.title}</option>
            ))}
          </select>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>取消</button>
            <button type="submit" className="btn btn-primary">添加</button>
          </div>
        </form>
      )}

      <div className="foreshadow-sections">
        <div className="foreshadow-section">
          <h4>🔴 待回收 ({openFss.length})</h4>
          {openFss.map(fs => (
            <div key={fs.id} className="foreshadow-item">
              <div className="foreshadow-content">{fs.content}</div>
              <div className="foreshadow-meta">
                {fs.planted_episode && (
                  <span className="foreshadow-planted">
                    埋于 {episodes?.find(ep => ep.id === fs.planted_episode)?.title || fs.planted_episode}
                  </span>
                )}
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleResolve(fs)}>
                  标记回收
                </button>
              </div>
            </div>
          ))}
          {openFss.length === 0 && <p className="muted">暂无待回收伏笔</p>}
        </div>

        <div className="foreshadow-section">
          <h4>✅ 已回收 ({resolvedFss.length})</h4>
          {resolvedFss.map(fs => (
            <div key={fs.id} className="foreshadow-item resolved">
              <div className="foreshadow-content">{fs.content}</div>
              <div className="foreshadow-meta">
                {fs.resolved_episode && (
                  <span className="foreshadow-resolved">
                    回收于 {episodes?.find(ep => ep.id === fs.resolved_episode)?.title || fs.resolved_episode}
                  </span>
                )}
              </div>
            </div>
          ))}
          {resolvedFss.length === 0 && <p className="muted">暂无已回收伏笔</p>}
        </div>
      </div>
    </div>
  );
}
