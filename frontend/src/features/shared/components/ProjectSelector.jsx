import FancySelect from '../../../components/FancySelect.jsx'

export default function ProjectSelector({ value, onChange, options, loading, kicker = '当前项目' }) {
  return (
    <FancySelect
      kicker={kicker}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={loading ? '加载中…' : '选择项目'}
      disabled={loading || options.length === 0}
      menuMinWidth={280}
    />
  )
}
