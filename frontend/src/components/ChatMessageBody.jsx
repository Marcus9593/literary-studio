import { renderSimpleMarkdown } from '../lib/simpleMarkdown.js'
import { stripModelToolArtifacts } from '../lib/stripToolArtifacts.js'

/** 助手消息 Markdown 渲染；用户消息保持纯文本 */
export default function ChatMessageBody({ role, content }) {
  if (role === 'assistant') {
    const html = renderSimpleMarkdown(stripModelToolArtifacts(content || ''))
    return (
      <div
        className="chat-bubble-body chat-bubble-markdown"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  return <div className="chat-bubble-body">{content}</div>
}
