import { useState, useEffect } from 'react';

const INT_EXT_OPTIONS = ['INT', 'EXT', 'INT-EXT'];
const TIME_OPTIONS = ['日', '夜', '晨', '黄昏', '深夜'];
const ACT_OPTIONS = [
  { value: 1, label: '第一幕（建置）' },
  { value: 2, label: '第二幕（对抗）' },
  { value: 3, label: '第三幕（解决）' },
];

export default function SceneEditPanel({ scene, storylines, onSave, onClose }) {
  const [form, setForm] = useState({
    int_ext: 'INT',
    location: '',
    time_of_day: '日',
    characters: [],
    storyline: 'main',
    act: 1,
    duration_estimate: 2,
    synopsis: '',
    tags: [],
  });
  const [charInput, setCharInput] = useState('');

  useEffect(() => {
    if (scene) {
      setForm({
        int_ext: scene.int_ext || 'INT',
        location: scene.location || '',
        time_of_day: scene.time_of_day || '日',
        characters: scene.characters || [],
        storyline: scene.storyline || 'main',
        act: scene.act || 1,
        duration_estimate: scene.duration_estimate || 2,
        synopsis: scene.synopsis || '',
        tags: scene.tags || [],
      });
    }
  }, [scene]);

  const handleAddChar = () => {
    const name = charInput.trim();
    if (name && !form.characters.includes(name)) {
      setForm(prev => ({ ...prev, characters: [...prev.characters, name] }));
      setCharInput('');
    }
  };

  const handleRemoveChar = (name) => {
    setForm(prev => ({ ...prev, characters: prev.characters.filter(c => c !== name) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.(form);
  };

  if (!scene) return null;

  return (
    <div className="scene-edit-panel">
      <div className="scene-edit-panel-header">
        <h3>编辑场景 #{scene.number}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>

      <form onSubmit={handleSubmit} className="scene-edit-form">
        <div className="form-row">
          <label>内/外景</label>
          <select value={form.int_ext} onChange={e => setForm(p => ({ ...p, int_ext: e.target.value }))}>
            {INT_EXT_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>地点</label>
          <input
            type="text"
            value={form.location}
            onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
            placeholder="咖啡厅"
          />
        </div>

        <div className="form-row">
          <label>时间</label>
          <select value={form.time_of_day} onChange={e => setForm(p => ({ ...p, time_of_day: e.target.value }))}>
            {TIME_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>幕</label>
          <select value={form.act} onChange={e => setForm(p => ({ ...p, act: parseInt(e.target.value) }))}>
            {ACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>故事线</label>
          <select value={form.storyline} onChange={e => setForm(p => ({ ...p, storyline: e.target.value }))}>
            {(storylines || []).map(sl => (
              <option key={sl.id} value={sl.id}>{sl.label}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>预计时长（分钟）</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={form.duration_estimate}
            onChange={e => setForm(p => ({ ...p, duration_estimate: parseFloat(e.target.value) || 1 }))}
          />
        </div>

        <div className="form-row">
          <label>角色</label>
          <div className="char-input-row">
            <input
              type="text"
              value={charInput}
              onChange={e => setCharInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddChar())}
              placeholder="输入角色名，回车添加"
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddChar}>+</button>
          </div>
          <div className="char-tags">
            {form.characters.map(ch => (
              <span key={ch} className="char-tag">
                {ch}
                <button type="button" onClick={() => handleRemoveChar(ch)}>×</button>
              </span>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label>梗概</label>
          <textarea
            value={form.synopsis}
            onChange={e => setForm(p => ({ ...p, synopsis: e.target.value }))}
            placeholder="这一场发生什么..."
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">保存</button>
        </div>
      </form>
    </div>
  );
}
