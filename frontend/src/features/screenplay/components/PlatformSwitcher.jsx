const PLATFORMS = [
  { id: 'douyin', label: '抖音', maxDuration: 60 },
  { id: 'bilibili', label: 'B站', maxDuration: 600 },
  { id: 'xiaohongshu', label: '小红书', maxDuration: 60 },
  { id: 'kuaishou', label: '快手', maxDuration: 60 },
  { id: 'custom', label: '自定义', maxDuration: 600 },
];

export default function PlatformSwitcher({ platform, onChange }) {
  const current = PLATFORMS.find(p => p.id === platform) || PLATFORMS[0];

  const handleChange = (newPlatform) => {
    const p = PLATFORMS.find(pl => pl.id === newPlatform);
    onChange?.({ platform: newPlatform, target_duration: p?.maxDuration || 60 });
  };

  return (
    <div className="platform-switcher">
      <select value={platform} onChange={e => handleChange(e.target.value)}>
        {PLATFORMS.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
    </div>
  );
}
