const CHANGE_LABEL = {
  added: '新建',
  modified: '更新',
};

export default function ChatFileChangesCard({ files = [], onPreview }) {
  if (!files?.length) return null;

  return (
    <div className="chat-file-changes">
      <strong>项目文件变更</strong>
      <ul className="chat-file-changes-list">
        {files.map((file) => (
          <li key={`${file.rel_path || file.display_path}-${file.change}`}>
            <span className="chat-file-changes-badge">
              {CHANGE_LABEL[file.change] || file.change}
            </span>
            <span className="chat-file-changes-path" title={file.display_path}>
              {file.display_path || file.filename}
            </span>
            {file.words ? (
              <span className="muted chat-file-changes-words">{file.words} 字</span>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm chat-file-changes-preview"
              onClick={() => onPreview?.(file)}
            >
              预览
            </button>
          </li>
        ))}
      </ul>
      <p className="muted chat-file-changes-hint">
        文件已保存到项目工作区；点击「预览」查看内容，不会打断当前对话。
      </p>
    </div>
  );
}
