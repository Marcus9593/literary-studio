export default function StorylineLegend({ storylines, activeFilter, onFilterChange, onEdit }) {
  return (
    <div className="storyline-legend">
      <div className="storyline-legend-items">
        <button
          type="button"
          className={`storyline-tag ${!activeFilter ? 'active' : ''}`}
          onClick={() => onFilterChange?.(null)}
        >
          全部
        </button>
        {(storylines || []).map(sl => (
          <button
            key={sl.id}
            type="button"
            className={`storyline-tag ${activeFilter === sl.id ? 'active' : ''}`}
            style={{ '--sl-color': sl.color }}
            onClick={() => onFilterChange?.(activeFilter === sl.id ? null : sl.id)}
          >
            <span className="storyline-dot" style={{ background: sl.color }} />
            {sl.label}
          </button>
        ))}
      </div>
      {onEdit && (
        <button type="button" className="btn btn-ghost btn-xs" onClick={onEdit}>
          编辑故事线
        </button>
      )}
    </div>
  );
}
