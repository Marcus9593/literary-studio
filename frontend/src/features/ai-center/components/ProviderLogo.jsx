import { useMemo, useState } from 'react'
import manifest from '@shared/provider-icons-manifest.json'

const ICON_URLS = manifest?.icons || {}

function hashColor(text) {
  let h = 0
  const s = String(text || 'x')
  for (let i = 0; i < s.length; i += 1) {
    h = s.charCodeAt(i) + ((h << 5) - h)
  }
  const hue = Math.abs(h) % 360
  return `hsl(${hue} 45% 42%)`
}

function initials(name) {
  const s = String(name || '').trim()
  if (!s) return '?'
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return s.slice(0, 2).toUpperCase()
}

export default function ProviderLogo({ icon, name, size = 32, className = '' }) {
  const [failed, setFailed] = useState(false)
  const src = useMemo(() => {
    if (!icon || failed) return null
    const entry = ICON_URLS[icon]
    return entry?.url || null
  }, [icon, failed])

  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.38)),
    background: hashColor(icon || name),
  }

  if (src) {
    return (
      <span
        className={`preset-picker-row-logo${className ? ` ${className}` : ''}`}
        style={{ width: size, height: size }}
      >
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </span>
    )
  }

  return (
    <span
      className={`preset-picker-row-logo preset-picker-row-logo-fallback${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
