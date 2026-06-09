import { useEffect, useId, useRef, useState } from 'react'

/**
 * 自定义下拉选择器（替代原生 select），全站统一视觉。
 * variant: default（带图标）| form（表单行）| minimal（工具栏紧凑）
 */
export default function FancySelect({
  label,
  kicker,
  value,
  onChange,
  options = [],
  placeholder = '请选择',
  disabled = false,
  align = 'left',
  className = '',
  menuMinWidth,
  variant = 'default',
  minimal = false,
  id,
  menuHeader = null,
  menuFooter = null,
  emptyMessage = '暂无可选项',
  renderOptionExtra = null,
}) {
  const resolvedVariant = minimal ? 'minimal' : variant
  const showIcon = resolvedVariant === 'default'
  const isForm = resolvedVariant === 'form'
  const isMinimal = resolvedVariant === 'minimal'
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (next) => {
    onChange?.(next)
    setOpen(false)
  }

  const rootClass = [
    'fancy-select',
    open ? 'is-open' : '',
    disabled ? 'is-disabled' : '',
    isForm ? 'fancy-select-block fancy-select-form' : '',
    isMinimal ? 'fancy-select-compact' : '',
    className,
  ].filter(Boolean).join(' ')

  const triggerClass = [
    'fancy-select-trigger',
    isForm ? 'fancy-select-trigger-form' : '',
    isMinimal ? 'fancy-select-trigger-minimal' : '',
  ].filter(Boolean).join(' ')

  return (
    <div ref={rootRef} className={rootClass}>
      <button
        id={id}
        type="button"
        className={triggerClass}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label || kicker || undefined}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        {showIcon && (
          <span className="fancy-select-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 6.5h16M4 12h10M4 17.5h7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
        <span className="fancy-select-body">
          {!isMinimal && !isForm && (kicker || label) && (
            <span className="fancy-select-kicker">{kicker || label}</span>
          )}
          <span className="fancy-select-value">{selected?.label || placeholder}</span>
          {!isMinimal && selected?.meta && (
            <span className="fancy-select-meta">{selected.meta}</span>
          )}
        </span>
        <span className="fancy-select-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className={`fancy-select-menu fancy-select-menu-${align}`}
          style={menuMinWidth ? { minWidth: menuMinWidth } : undefined}
        >
          {menuHeader && (
            <div className="fancy-select-menu-slot fancy-select-menu-header">{menuHeader}</div>
          )}
          {options.length === 0 ? (
            <p className="fancy-select-empty">{emptyMessage}</p>
          ) : (
            options.map((opt) => {
              const active = opt.value === value
              const optDisabled = !!opt.disabled
              const extra = renderOptionExtra?.(opt, { active })
              return (
                <div
                  key={opt.value}
                  className={[
                    'fancy-select-option-row',
                    active ? 'active' : '',
                    optDisabled ? 'is-disabled' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-disabled={optDisabled || undefined}
                    disabled={optDisabled}
                    className={`fancy-select-option ${active ? 'active' : ''}`}
                    onClick={() => !optDisabled && pick(opt.value)}
                  >
                    <span className="fancy-select-option-main">
                      <span className="fancy-select-option-label">{opt.label}</span>
                      {opt.meta && (
                        <span className="fancy-select-option-meta">{opt.meta}</span>
                      )}
                    </span>
                    {active && !extra && (
                      <span className="fancy-select-check" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 12.5l4.2 4.2L19 7"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                  {extra}
                </div>
              )
            })
          )}
          {menuFooter && (
            <div className="fancy-select-menu-slot fancy-select-menu-footer">{menuFooter}</div>
          )}
        </div>
      )}
    </div>
  )
}
