import { useState, useCallback } from 'react';
import SceneCard from './SceneCard.jsx';
import SceneEditPanel from './SceneEditPanel.jsx';
import StorylineLegend from './StorylineLegend.jsx';

const ACT_LABELS = [
  { value: 1, label: '第一幕', sublabel: '建置' },
  { value: 2, label: '第二幕', sublabel: '对抗' },
  { value: 3, label: '第三幕', sublabel: '解决' },
];

export default function SceneBoard({
  screenplay,
  onAddScene,
  onEditScene,
  onDeleteScene,
  onReorderScenes,
  onSaveStorylines,
}) {
  const [editScene, setEditScene] = useState(null);
  const [filterStoryline, setFilterStoryline] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ int_ext: 'INT', location: '', time_of_day: '日', act: 1, characters: [], storyline: 'main', synopsis: '', duration_estimate: 2 });
  const [dragId, setDragId] = useState(null);

  const scenes = screenplay?.scenes || [];
  const storylines = screenplay?.storylines || [];

  const storylineColorMap = {};
  for (const sl of storylines) storylineColorMap[sl.id] = sl.color;

  const filteredScenes = filterStoryline
    ? scenes.filter(s => s.storyline === filterStoryline)
    : scenes;

  // 按幕分组
  const scenesByAct = { 1: [], 2: [], 3: [] };
  for (const sc of filteredScenes) {
    const act = sc.act || 1;
    if (!scenesByAct[act]) scenesByAct[act] = [];
    scenesByAct[act].push(sc);
  }

  // 拖拽处理
  const handleDragStart = useCallback((e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;

    const allIds = scenes.map(s => s.id);
    const fromIdx = allIds.indexOf(dragId);
    const toIdx = allIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newOrder = [...allIds];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragId);
    onReorderScenes?.(newOrder);
    setDragId(null);
  }, [dragId, scenes, onReorderScenes]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.location.trim()) return;
    await onAddScene?.(addForm);
    setAddForm({ int_ext: 'INT', location: '', time_of_day: '日', act: 1, characters: [], storyline: 'main', synopsis: '', duration_estimate: 2 });
    setShowAddForm(false);
  };

  const totalDuration = scenes.reduce((s, sc) => s + (sc.duration_estimate || 0), 0);

  return (
    <div className="scene-board">
      {/* 工具栏 */}
      <div className="scene-board-toolbar">
        <div className="scene-board-info">
          <span>{scenes.length} 场</span>
          <span>·</span>
          <span>预计 {totalDuration} 分钟</span>
        </div>
        <StorylineLegend
          storylines={storylines}
          activeFilter={filterStoryline}
          onFilterChange={setFilterStoryline}
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>
          + 新增场景
        </button>
      </div>

      {/* 新增场景表单 */}
      {showAddForm && (
        <div className="scene-add-form card">
          <h4>新增场景</h4>
          <form onSubmit={handleAddSubmit}>
            <div className="form-row-inline">
              <select value={addForm.int_ext} onChange={e => setAddForm(p => ({ ...p, int_ext: e.target.value }))}>
                <option value="INT">INT</option>
                <option value="EXT">EXT</option>
                <option value="INT-EXT">INT-EXT</option>
              </select>
              <input type="text" placeholder="地点" value={addForm.location} onChange={e => setAddForm(p => ({ ...p, location: e.target.value }))} required />
              <select value={addForm.time_of_day} onChange={e => setAddForm(p => ({ ...p, time_of_day: e.target.value }))}>
                <option value="日">日</option>
                <option value="夜">夜</option>
                <option value="晨">晨</option>
                <option value="黄昏">黄昏</option>
              </select>
              <select value={addForm.act} onChange={e => setAddForm(p => ({ ...p, act: parseInt(e.target.value) }))}>
                {ACT_LABELS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <input type="text" placeholder="梗概（可选）" value={addForm.synopsis} onChange={e => setAddForm(p => ({ ...p, synopsis: e.target.value }))} />
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>取消</button>
              <button type="submit" className="btn btn-primary">添加</button>
            </div>
          </form>
        </div>
      )}

      {/* 场景看板 - 按幕分列 */}
      <div className="scene-board-columns">
        {ACT_LABELS.map(act => (
          <div key={act.value} className="scene-board-column">
            <div className="scene-column-header">
              <h3>{act.label}</h3>
              <span className="scene-column-sublabel">{act.sublabel}</span>
              <span className="scene-column-count">{scenesByAct[act.value]?.length || 0} 场</span>
            </div>
            <div className="scene-column-body">
              {(scenesByAct[act.value] || []).map(sc => (
                <SceneCard
                  key={sc.id}
                  scene={sc}
                  storylineColor={storylineColorMap[sc.storyline]}
                  isDragging={dragId === sc.id}
                  onSelect={() => setEditScene(sc)}
                  onEdit={() => setEditScene(sc)}
                  onDelete={onDeleteScene}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
              {(!scenesByAct[act.value] || scenesByAct[act.value].length === 0) && (
                <div className="scene-column-empty">暂无场景</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 编辑面板 */}
      {editScene && (
        <SceneEditPanel
          scene={editScene}
          storylines={storylines}
          onSave={async (data) => {
            await onEditScene?.(editScene.id, data);
            setEditScene(null);
          }}
          onClose={() => setEditScene(null)}
        />
      )}
    </div>
  );
}
