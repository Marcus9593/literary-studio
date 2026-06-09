export default function RhythmVisualizer({ shots, sections, targetDuration }) {
  const totalDuration = shots.reduce((s, sh) => s + (sh.duration || 0), 0);
  const percentage = targetDuration > 0 ? Math.min(100, (totalDuration / targetDuration) * 100) : 0;

  const sectionColors = {
    hook: '#FF6B6B',
    content: '#4ECDC4',
    cta: '#FFE66D',
  };

  return (
    <div className="rhythm-visualizer">
      <div className="rhythm-header">
        <span>时间线</span>
        <span className={totalDuration > targetDuration ? 'over-target' : ''}>
          {totalDuration}s / {targetDuration}s ({Math.round(percentage)}%)
        </span>
      </div>

      <div className="rhythm-bar">
        {shots.map(sh => {
          const sec = sections.find(s => s.id === sh.section_id);
          const color = sectionColors[sec?.type] || '#888';
          const width = targetDuration > 0 ? (sh.duration / targetDuration * 100) : 0;
          return (
            <div
              key={sh.id}
              className="rhythm-segment"
              style={{ width: `${width}%`, background: color }}
              title={`#${sh.number} ${sh.duration}s`}
            />
          );
        })}
      </div>

      <div className="rhythm-legend">
        {sections.map(sec => (
          <span key={sec.id} className="rhythm-legend-item">
            <span className="rhythm-legend-dot" style={{ background: sectionColors[sec.type] || '#888' }} />
            {sec.label}
          </span>
        ))}
      </div>

      {totalDuration > targetDuration && (
        <div className="rhythm-warning">
          ⚠️ 超出目标时长 {totalDuration - targetDuration}秒
        </div>
      )}
    </div>
  );
}
