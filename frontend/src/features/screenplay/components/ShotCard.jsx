export default function ShotCard({
  shot,
  isDragging,
  onSelect,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  return (
    <div
      className={`shot-card ${isDragging ? 'shot-card-dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart?.(e, shot.id)}
      onDragOver={(e) => onDragOver?.(e)}
      onDrop={(e) => onDrop?.(e, shot.id)}
      onClick={() => onSelect?.(shot)}
    >
      <div className="shot-card-header">
        <span className="shot-number">#{shot.number}</span>
        <span className="shot-duration">{shot.duration}s</span>
        <div className="shot-card-actions">
          <button type="button" className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); onEdit?.(shot); }}>编辑</button>
          <button type="button" className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); onDelete?.(shot.id); }}>×</button>
        </div>
      </div>
      <div className="shot-card-body">
        {shot.visual && <div className="shot-visual">📹 {shot.visual}</div>}
        {shot.subtitle && <div className="shot-subtitle">📝 {shot.subtitle}</div>}
        {shot.narration && <div className="shot-narration">🎤 {shot.narration}</div>}
        {shot.music && <div className="shot-music">🎵 {shot.music}</div>}
        {shot.camera_note && <div className="shot-camera">📷 {shot.camera_note}</div>}
      </div>
    </div>
  );
}
