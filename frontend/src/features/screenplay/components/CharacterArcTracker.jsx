import { useState } from 'react';

export default function CharacterArcTracker({ characterArcs, episodes, onUpdate }) {
  const [editName, setEditName] = useState(null);
  const [editForm, setEditForm] = useState({ role: '', season_arc: '' });

  const arcs = Object.entries(characterArcs || {}).map(([name, data]) => ({ name, ...data }));

  const handleEdit = (name) => {
    const arc = characterArcs?.[name] || {};
    setEditName(name);
    setEditForm({ role: arc.role || '', season_arc: arc.season_arc || '' });
  };

  const handleSave = async () => {
    await onUpdate?.(editName, editForm);
    setEditName(null);
  };

  return (
    <div className="character-arc-tracker">
      <div className="character-arc-header">
        <h3>角色弧线</h3>
        <span className="arc-count">{arcs.length} 角色</span>
      </div>

      {arcs.length === 0 ? (
        <p className="muted">暂无角色弧线数据。在场景中添加角色后自动追踪。</p>
      ) : (
        <div className="character-arc-list">
          {arcs.map(arc => (
            <div key={arc.name} className="character-arc-item">
              <div className="arc-name">{arc.name}</div>
              <div className="arc-role">{arc.role || '未设定'}</div>
              <div className="arc-season">{arc.season_arc || '未设定成长线'}</div>
              <div className="arc-episodes">
                出场: {(arc.episodes_appeared || []).length} 集
              </div>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleEdit(arc.name)}>
                编辑
              </button>
            </div>
          ))}
        </div>
      )}

      {editName && (
        <div className="character-arc-edit card">
          <h4>编辑 {editName} 的弧线</h4>
          <input type="text" placeholder="角色定位（protagonist/antagonist/supporting）" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} />
          <textarea placeholder="整季成长弧线（如：从逃避到面对）" value={editForm.season_arc} onChange={e => setEditForm(p => ({ ...p, season_arc: e.target.value }))} rows={2} />
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditName(null)}>取消</button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>保存</button>
          </div>
        </div>
      )}
    </div>
  );
}
