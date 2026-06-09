import { useState } from 'react';

const INT_EXT_COLORS = {
  INT: '#4A90D9',
  EXT: '#5CB85C',
  'INT-EXT': '#F0AD4E',
};

const ACT_LABELS = { 1: '第一幕', 2: '第二幕', 3: '第三幕' };

export default function SceneCard({
  scene,
  storylineColor,
  onSelect,
  onEdit,
  onDelete,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const [showMenu, setShowMenu] = useState(false);

  const intColor = INT_EXT_COLORS[scene.int_ext] || '#888';

  return (
    <div
      className={`scene-card ${isDragging ? 'scene-card-dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart?.(e, scene.id)}
      onDragOver={(e) => onDragOver?.(e, scene.id)}
      onDrop={(e) => onDrop?.(e, scene.id)}
      onClick={() => onSelect?.(scene)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div className="scene-card-header">
        <span
          className="scene-card-int-ext"
          style={{ background: intColor }}
        >
          {scene.int_ext || 'INT'}
        </span>
        <span className="scene-card-number">#{scene.number}</span>
        {scene.act && (
          <span className="scene-card-act">{ACT_LABELS[scene.act] || `第${scene.act}幕`}</span>
        )}
        <div className="scene-card-menu-trigger">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            ⋯
          </button>
          {showMenu && (
            <div className="scene-card-menu">
              <button type="button" onClick={(e) => { e.stopPropagation(); onEdit?.(scene); setShowMenu(false); }}>
                编辑
              </button>
              <button type="button" className="danger" onClick={(e) => { e.stopPropagation(); onDelete?.(scene.id); setShowMenu(false); }}>
                删除
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="scene-card-body">
        <div className="scene-card-location">
          {scene.location || '未命名'}
        </div>
        <div className="scene-card-time">{scene.time_of_day || '日'}</div>
        {scene.synopsis && (
          <div className="scene-card-synopsis">{scene.synopsis}</div>
        )}
      </div>

      <div className="scene-card-footer">
        {scene.characters?.length > 0 && (
          <div className="scene-card-characters">
            {scene.characters.slice(0, 3).map(ch => (
              <span key={ch} className="scene-card-char-tag">{ch}</span>
            ))}
            {scene.characters.length > 3 && (
              <span className="scene-card-char-more">+{scene.characters.length - 3}</span>
            )}
          </div>
        )}
        <div className="scene-card-meta">
          {scene.storyline && storylineColor && (
            <span
              className="scene-card-storyline-dot"
              style={{ background: storylineColor }}
              title={scene.storyline}
            />
          )}
          {scene.duration_estimate > 0 && (
            <span className="scene-card-duration">~{scene.duration_estimate}min</span>
          )}
        </div>
      </div>
    </div>
  );
}
