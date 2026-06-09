const VARIANTS = {
  ok: 'ok',
  warn: 'warn',
  err: 'err',
  info: 'info',
  neutral: 'neutral',
}

export default function StatusBadge({ variant = 'neutral', children, dot }) {
  const v = VARIANTS[variant] || variant
  return (
    <span className={`status-badge status-badge-${v}`}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  )
}
