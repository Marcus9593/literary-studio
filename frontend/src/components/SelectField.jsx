import FancySelect from './FancySelect.jsx'

/** 表单标签 + FancySelect（form 样式） */
export default function SelectField({
  label,
  htmlFor,
  hint,
  className = '',
  ...fancyProps
}) {
  return (
    <div className={`field field-fancy-select ${className}`.trim()}>
      {label && (
        <label htmlFor={htmlFor || fancyProps.id}>
          {label}
        </label>
      )}
      {hint && <p className="field-hint">{hint}</p>}
      <FancySelect variant="form" {...fancyProps} id={htmlFor || fancyProps.id} />
    </div>
  )
}
