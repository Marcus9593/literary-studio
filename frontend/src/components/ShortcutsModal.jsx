import Modal from './Modal.jsx'

const SHORTCUTS = [
  { keys: ['⌘', 'S'], label: '保存当前文稿' },
  { keys: ['⌘', '←'], label: '上一章 / 上一篇文稿' },
  { keys: ['⌘', '→'], label: '下一章 / 下一篇文稿' },
  { keys: ['F'], label: '切换专注模式（隐藏侧栏与对话）' },
  { keys: ['?'], label: '打开快捷键帮助' },
  { keys: ['Esc'], label: '关闭弹窗 / 退出专注模式' },
  { keys: ['Enter'], label: '发送对话（输入框内）' },
  { keys: ['Shift', 'Enter'], label: '对话换行' },
]

export default function ShortcutsModal({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="快捷键"
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          知道了
        </button>
      }
    >
      <ul className="shortcuts-list">
        {SHORTCUTS.map((item) => (
          <li key={item.label} className="shortcuts-row">
            <span className="shortcuts-keys">
              {item.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            <span className="shortcuts-label">{item.label}</span>
          </li>
        ))}
      </ul>
      <p className="muted shortcuts-note">Windows / Linux 用户请将 ⌘ 换为 Ctrl。</p>
    </Modal>
  )
}
