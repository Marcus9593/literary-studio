import FancySelect from './FancySelect.jsx'
import { isChapterSession, sessionScopeLabel } from '../lib/sessionScope.js'

export default function SessionSelector({
  sessions,
  chapters = [],
  activeId,
  onSelect,
  onCreate,
  onDelete,
}) {
  const options = sessions.map((s) => ({
    value: s.id,
    label: s.title,
    meta: `${isChapterSession(s) ? sessionScopeLabel(s, chapters) : '全书'} · ${s.message_count ?? 0} 条`,
  }))

  return (
    <FancySelect
      className="fancy-select-session"
      variant="form"
      value={activeId || ''}
      onChange={onSelect}
      options={options}
      placeholder="选择会话"
      label="对话会话"
      emptyMessage="暂无会话，可新建"
      menuMinWidth="100%"
      menuHeader={(
        <button
          type="button"
          className="fancy-select-menu-action"
          onClick={() => onCreate?.()}
        >
          + 新建会话
        </button>
      )}
      renderOptionExtra={(opt) => (
        <button
          type="button"
          className="fancy-select-option-remove"
          title="删除会话"
          aria-label="删除会话"
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.(opt.value)
          }}
        >
          ×
        </button>
      )}
    />
  )
}
