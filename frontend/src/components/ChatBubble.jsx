import { useState } from 'react'
import ChatMessageBody from './ChatMessageBody.jsx'
import ChatPlanExecutionCard from './ChatPlanExecutionCard.jsx'
import ChatFileChangesCard from './ChatFileChangesCard.jsx'

export default function ChatBubble({
  message,
  index,
  onCopy,
  onRetry,
  onRegenerate,
  onApplyWritePlan,
  onPreviewFile,
  stripContent,
}) {
  const [copied, setCopied] = useState(false)
  const content = stripContent ? stripContent(message.content) : message.content
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '')
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onCopy?.(false)
    }
  }

  return (
    <div className={`chat-bubble chat-bubble-${message.role}`}>
      <span className="chat-avatar" aria-hidden="true">{isUser ? '你' : '匠'}</span>
      <div className="chat-bubble-inner">
        <div className="chat-bubble-head">
          <span className="chat-bubble-label">{isUser ? '你' : '创作助手'}</span>
          <div className="chat-bubble-actions">
          <button
            type="button"
            className="chat-bubble-action"
            onClick={handleCopy}
            title="复制"
          >
            {copied ? '已复制' : '复制'}
          </button>
          {isUser && onRetry && (
            <button
              type="button"
              className="chat-bubble-action"
              onClick={() => onRetry(message.content, index)}
              title="重新发送此消息"
            >
              重试
            </button>
          )}
          {!isUser && onRegenerate && (
            <button
              type="button"
              className="chat-bubble-action"
              onClick={() => onRegenerate(index)}
              title="根据上一条提问重新生成"
            >
              重新生成
            </button>
          )}
          </div>
        </div>
        {content?.trim() ? (
          <ChatMessageBody role={message.role} content={content} />
        ) : null}
        {message.plan_execution ? (
          <ChatPlanExecutionCard plan={message.plan_execution} />
        ) : null}
        {message.write_plan && (
          <div className="chat-write-plan">
            <strong>写作方案</strong>
            <p>
              第 {message.write_plan.chapter ?? '—'} 章 · {message.write_plan.title}
            </p>
            <p className="muted">{message.write_plan.outline}</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onApplyWritePlan?.(message.write_plan)}
            >
              采用并生成文稿
            </button>
          </div>
        )}
        {message.file_changes?.length > 0 && (
          <ChatFileChangesCard
            files={message.file_changes}
            onPreview={onPreviewFile}
          />
        )}
      </div>
    </div>
  )
}
