import { useState } from 'react';
import ShotCard from './ShotCard.jsx';
import RhythmVisualizer from './RhythmVisualizer.jsx';
import PlatformSwitcher from './PlatformSwitcher.jsx';

export default function ShotBoard({
  screenplay,
  onAddShot,
  onEditShot,
  onDeleteShot,
  onReorderShots,
  onEditSections,
  onEditPlatform,
}) {
  const [editShot, setEditShot] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ section_id: 'sec_content', visual: '', subtitle: '', narration: '', music: '', duration: 3, camera_note: '' });
  const [dragId, setDragId] = useState(null);
  const [showRhythm, setShowRhythm] = useState(false);

  const shots = screenplay?.shots || [];
  const sections = screenplay?.sections || [];
  const platform = screenplay?.platform || 'douyin';
  const targetDuration = screenplay?.target_duration || 60;

  // 按段落分组
  const shotsBySection = {};
  for (const sec of sections) shotsBySection[sec.id] = [];
  for (const sh of shots) {
    const sid = sh.section_id || 'sec_content';
    if (!shotsBySection[sid]) shotsBySection[sid] = [];
    shotsBySection[sid].push(sh);
  }

  const totalDuration = shots.reduce((s, sh) => s + (sh.duration || 0), 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    await onAddShot?.(addForm);
    setAddForm({ section_id: 'sec_content', visual: '', subtitle: '', narration: '', music: '', duration: 3, camera_note: '' });
    setShowAdd(false);
  };

  const handleDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const allIds = shots.map(s => s.id);
    const fromIdx = allIds.indexOf(dragId);
    const toIdx = allIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...allIds];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragId);
    onReorderShots?.(newOrder);
    setDragId(null);
  };

  return (
    <div className="shot-board">
      <div className="shot-board-toolbar">
        <div className="shot-board-info">
          <span>{shots.length} 个分镜</span>
          <span>·</span>
          <span className={totalDuration > targetDuration ? 'over-target' : ''}>
            {totalDuration}s / {targetDuration}s
          </span>
        </div>
        <PlatformSwitcher platform={platform} onChange={onEditPlatform} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRhythm(!showRhythm)}>
          {showRhythm ? '隐藏' : '显示'}节奏
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          + 新增分镜
        </button>
      </div>

      {showRhythm && (
        <RhythmVisualizer shots={shots} sections={sections} targetDuration={targetDuration} />
      )}

      {showAdd && (
        <div className="shot-add-form card">
          <h4>新增分镜</h4>
          <form onSubmit={handleAdd}>
            <div className="form-row-inline">
              <select value={addForm.section_id} onChange={e => setAddForm(p => ({ ...p, section_id: e.target.value }))}>
                {sections.map(sec => <option key={sec.id} value={sec.id}>{sec.label}</option>)}
              </select>
              <input type="number" min="1" placeholder="时长(秒)" value={addForm.duration} onChange={e => setAddForm(p => ({ ...p, duration: parseInt(e.target.value) || 1 }))} style={{width: 80}} />
            </div>
            <input type="text" placeholder="画面描述" value={addForm.visual} onChange={e => setAddForm(p => ({ ...p, visual: e.target.value }))} />
            <input type="text" placeholder="字幕" value={addForm.subtitle} onChange={e => setAddForm(p => ({ ...p, subtitle: e.target.value }))} />
            <input type="text" placeholder="旁白" value={addForm.narration} onChange={e => setAddForm(p => ({ ...p, narration: e.target.value }))} />
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>取消</button>
              <button type="submit" className="btn btn-primary">添加</button>
            </div>
          </form>
        </div>
      )}

      <div className="shot-sections">
        {sections.map(sec => (
          <div key={sec.id} className="shot-section">
            <div className="shot-section-header">
              <span className={`shot-section-type type-${sec.type}`}>{sec.label}</span>
              <span className="shot-section-duration">
                {(shotsBySection[sec.id] || []).reduce((s, sh) => s + (sh.duration || 0), 0)}s / {sec.duration}s
              </span>
            </div>
            <div className="shot-section-body">
              {(shotsBySection[sec.id] || []).map(sh => (
                <ShotCard
                  key={sh.id}
                  shot={sh}
                  isDragging={dragId === sh.id}
                  onSelect={() => setEditShot(sh)}
                  onEdit={() => setEditShot(sh)}
                  onDelete={onDeleteShot}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
              {(!shotsBySection[sec.id] || shotsBySection[sec.id].length === 0) && (
                <div className="shot-section-empty">暂无分镜</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
