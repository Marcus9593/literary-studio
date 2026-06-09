import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createGuestbookPost,
  createGuestbookReply,
  deleteGuestbookPost,
  deleteGuestbookReply,
  listGuestbookPosts,
} from '../api.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRAND } from '../lib/brand.js'
import PageSlogan from '../components/PageSlogan.jsx'
import { useToast } from '../components/Toast.jsx'

const MAX_CONTENT = 1000
const MAX_IMAGES = 4

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ImageGrid({ images }) {
  if (!images?.length) return null
  return (
    <div className={`guestbook-images guestbook-images-${Math.min(images.length, 3)}`}>
      {images.map((img) => (
        <a
          key={img.id || img.url}
          href={img.url}
          target="_blank"
          rel="noreferrer"
          className="guestbook-image-link"
        >
          <img src={img.url} alt="" loading="lazy" />
        </a>
      ))}
    </div>
  )
}

function ComposeBox({
  placeholder,
  username,
  onSubmit,
  submitting,
  compact = false,
  anonymousDefault = false,
}) {
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [anonymous, setAnonymous] = useState(anonymousDefault)
  const fileRef = useRef(null)

  const remaining = MAX_CONTENT - content.length

  const onPickImages = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const next = [...images, ...files].slice(0, MAX_IMAGES)
    setImages(next)
    e.target.value = ''
  }

  const removeImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!content.trim()) return
    await onSubmit({ content, images, anonymous })
    setContent('')
    setImages([])
    setAnonymous(anonymousDefault)
  }

  return (
    <div className={`guestbook-compose ${compact ? 'guestbook-compose-compact' : ''}`}>
      <div className="guestbook-compose-head">
        <div className="guestbook-compose-identity">
          <span className="guestbook-author-label">
            {anonymous ? (
              <span className="guestbook-author-tag guestbook-author-anon">匿名用户</span>
            ) : (
              <span className="guestbook-author-tag">@{username}</span>
            )}
          </span>
          <label className="guestbook-anon-toggle">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <span>匿名发表</span>
          </label>
        </div>
        <span className={`guestbook-char-count ${remaining < 0 ? 'over' : ''}`}>
          {content.length}/{MAX_CONTENT}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
        placeholder={placeholder}
        rows={compact ? 3 : 4}
        maxLength={MAX_CONTENT}
      />
      {images.length > 0 && (
        <div className="guestbook-compose-previews">
          {images.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="guestbook-compose-preview">
              <img src={URL.createObjectURL(file)} alt="" />
              <button type="button" className="guestbook-preview-remove" onClick={() => removeImage(idx)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="guestbook-compose-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
        >
          图片 ({images.length}/{MAX_IMAGES})
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          hidden
          onChange={onPickImages}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={submitting || !content.trim()}
          onClick={handleSubmit}
        >
          {submitting ? '发送中…' : '发表'}
        </button>
      </div>
    </div>
  )
}

function AuthorName({ author, moderation }) {
  return (
    <span className="guestbook-author-display">
      <strong>{author}</strong>
      {moderation?.username && (
        <span className="guestbook-moderation-hint" title="仅超级管理员可见">
          （@{moderation.username}）
        </span>
      )}
    </span>
  )
}

function ReplyTree({
  replies,
  postId,
  username,
  onReply,
  onDeleteReply,
  canModerate,
  replyingId,
  setReplyingId,
  busy,
}) {
  const roots = []
  const map = new Map()
  for (const r of replies || []) {
    map.set(r.id, { ...r, children: [] })
  }
  for (const r of replies || []) {
    const node = map.get(r.id)
    if (r.parent_reply_id && map.has(r.parent_reply_id)) {
      map.get(r.parent_reply_id).children.push(node)
    } else {
      roots.push(node)
    }
  }

  const renderNode = (node, depth = 0) => (
    <div key={node.id} className="guestbook-reply" style={{ '--reply-depth': depth }}>
      <div className="guestbook-reply-bubble">
        <div className="guestbook-reply-meta">
          <AuthorName author={node.author} moderation={node.moderation} />
          <span className="muted">{formatTime(node.created_at)}</span>
        </div>
        <p className="guestbook-reply-text">{node.content}</p>
        <ImageGrid images={node.images} />
        <div className="guestbook-reply-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm guestbook-reply-btn"
            onClick={() => setReplyingId(replyingId === node.id ? null : node.id)}
          >
            回复
          </button>
          {canModerate && (
            <button
              type="button"
              className="btn btn-ghost btn-sm guestbook-delete-btn"
              disabled={busy}
              onClick={() => onDeleteReply(postId, node.id)}
            >
              删除
            </button>
          )}
        </div>
      </div>
      {replyingId === node.id && (
        <ComposeBox
          compact
          placeholder={`回复 ${node.author}…`}
          username={username}
          submitting={busy}
          onSubmit={async (payload) => {
            await onReply(postId, { ...payload, parent_reply_id: node.id })
            setReplyingId(null)
          }}
        />
      )}
      {node.children?.map((child) => renderNode(child, depth + 1))}
    </div>
  )

  return <div className="guestbook-reply-tree">{roots.map((n) => renderNode(n, 0))}</div>
}

function PostCard({ post, username, onReply, onDeletePost, onDeleteReply, canModerate, busy }) {
  const [replying, setReplying] = useState(false)
  const [replyingReplyId, setReplyingReplyId] = useState(null)

  return (
    <article className="guestbook-post card">
      <div className="guestbook-post-avatar" aria-hidden="true">
        {(post.author || '?').slice(0, 1)}
      </div>
      <div className="guestbook-post-body">
        <header className="guestbook-post-head">
          <AuthorName author={post.author} moderation={post.moderation} />
          <time className="muted">{formatTime(post.created_at)}</time>
        </header>
        <p className="guestbook-post-text">{post.content}</p>
        <ImageGrid images={post.images} />
        <div className="guestbook-post-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setReplying((v) => !v)}
          >
            {replying ? '取消回复' : `回复 (${post.reply_count || 0})`}
          </button>
          {canModerate && (
            <button
              type="button"
              className="btn btn-ghost btn-sm guestbook-delete-btn"
              disabled={busy}
              onClick={() => onDeletePost(post.id)}
            >
              删除留言
            </button>
          )}
        </div>
        {replying && (
          <ComposeBox
            compact
            placeholder="写下你的回复…"
            username={username}
            submitting={busy}
            onSubmit={async (payload) => {
              await onReply(post.id, payload)
              setReplying(false)
            }}
          />
        )}
        {(post.replies?.length > 0) && (
          <ReplyTree
            replies={post.replies}
            postId={post.id}
            username={username}
            onReply={onReply}
            onDeleteReply={onDeleteReply}
            canModerate={canModerate}
            replyingId={replyingReplyId}
            setReplyingId={setReplyingReplyId}
            busy={busy}
          />
        )}
      </div>
    </article>
  )
}

export default function GuestbookPage() {
  const { user, isSuperAdmin } = useAuth()
  const showToast = useToast()
  const username = user?.username || ''
  const canModerate = isSuperAdmin
  const [posts, setPosts] = useState([])
  const [stats, setStats] = useState({ post_count: 0, reply_count: 0 })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const limit = 15

  const refresh = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const data = await listGuestbookPosts(p, limit)
      setPosts(data.items || [])
      setTotal(data.total || 0)
      setStats(data.stats || { post_count: 0, reply_count: 0 })
      setPage(data.page || p)
    } catch (err) {
      showToast(err.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, showToast])

  useEffect(() => {
    refresh(1)
  }, [refresh])

  const appendIdentity = (fd, anonymous) => {
    if (anonymous) fd.append('anonymous', '1')
  }

  const submitPost = async ({ content, images, anonymous }) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('content', content.trim())
      appendIdentity(fd, anonymous)
      for (const file of images) fd.append('images', file)
      await createGuestbookPost(fd)
      showToast('留言已发表', 'success')
      await refresh(1)
    } catch (err) {
      showToast(err.message || '发表失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeletePost = async (postId) => {
    if (!window.confirm('确定删除这条留言及其全部回复？')) return
    setBusy(true)
    try {
      const data = await deleteGuestbookPost(postId)
      setStats(data.stats || stats)
      showToast('留言已删除', 'success')
      await refresh(page)
    } catch (err) {
      showToast(err.message || '删除失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteReply = async (postId, replyId) => {
    if (!window.confirm('确定删除这条回复？其子回复也会一并删除。')) return
    setBusy(true)
    try {
      const data = await deleteGuestbookReply(postId, replyId)
      setStats(data.stats || stats)
      showToast('回复已删除', 'success')
      await refresh(page)
    } catch (err) {
      showToast(err.message || '删除失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitReply = async (postId, { content, images, parent_reply_id, anonymous }) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('content', content.trim())
      appendIdentity(fd, anonymous)
      if (parent_reply_id) fd.append('parent_reply_id', parent_reply_id)
      for (const file of images) fd.append('images', file)
      await createGuestbookReply(postId, fd)
      showToast('回复已发表', 'success')
      await refresh(page)
    } catch (err) {
      showToast(err.message || '回复失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="page guestbook-page">
      <header className="page-header">
        <div>
          <h2>{BRAND.guestbook.title}</h2>
          <PageSlogan />
          <p>{BRAND.guestbook.intro}</p>
        </div>
      </header>

      <section className="card guestbook-wall">
        <div className="guestbook-wall-head">
          <h3>写下建议</h3>
          <p className="muted">
            共 {stats.post_count} 条留言 · {stats.reply_count} 条回复 · 最多 {MAX_CONTENT} 字 · 最多 {MAX_IMAGES} 张图
          </p>
        </div>
        <ComposeBox
          placeholder="对文匠 Studio 的想法、建议或吐槽…"
          username={username}
          onSubmit={submitPost}
          submitting={busy}
        />
      </section>

      {loading ? (
        <p className="muted guestbook-loading">加载留言…</p>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <h3>还没有留言</h3>
          <p>成为第一个给平台留言的人吧。</p>
        </div>
      ) : (
        <div className="guestbook-feed">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              username={username}
              onReply={submitReply}
              onDeletePost={handleDeletePost}
              onDeleteReply={handleDeleteReply}
              canModerate={canModerate}
              busy={busy}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="tools-pagination guestbook-pagination">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={page <= 1 || loading}
            onClick={() => refresh(page - 1)}
          >
            上一页
          </button>
          <span>第 {page} / {totalPages} 页</span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={page >= totalPages || loading}
            onClick={() => refresh(page + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
