import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createGuestbookPost,
  deleteGuestbookPost,
  listGuestbookPosts,
  updateGuestbookPost,
} from '../api.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRAND } from '../lib/brand.js'
import PageSlogan from '../components/PageSlogan.jsx'
import { useToast } from '../components/Toast.jsx'

const MAX_CONTENT = 2000
const MAX_IMAGES = 4
const TAGS = [
  { value: '灵感', color: '#e67e22', icon: '💡' },
  { value: '待办', color: '#e74c3c', icon: '📌' },
  { value: '进度', color: '#27ae60', icon: '📊' },
  { value: '反馈', color: '#3498db', icon: '💬' },
  { value: '其他', color: '#95a5a6', icon: '📝' },
]

function tagInfo(tag) {
  return TAGS.find((t) => t.value === tag) || TAGS[TAGS.length - 1]
}

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

function ComposeBox({ placeholder, username, onSubmit, submitting }) {
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [tag, setTag] = useState('其他')
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
    await onSubmit({ content, images, tag })
    setContent('')
    setImages([])
    setTag('其他')
  }

  return (
    <div className="guestbook-compose">
      <div className="guestbook-compose-head">
        <span className="guestbook-author-tag">@{username}</span>
        <span className={`guestbook-char-count ${remaining < 0 ? 'over' : ''}`}>
          {content.length}/{MAX_CONTENT}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
        placeholder={placeholder}
        rows={4}
        maxLength={MAX_CONTENT}
      />
      <div className="journal-tag-picker">
        {TAGS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`journal-tag-chip ${tag === t.value ? 'journal-tag-active' : ''}`}
            style={{
              '--tag-color': t.color,
              borderColor: tag === t.value ? t.color : 'var(--border)',
              background: tag === t.value ? `${t.color}15` : 'transparent',
              color: tag === t.value ? t.color : 'var(--ink-muted)',
            }}
            onClick={() => setTag(t.value)}
          >
            {t.icon} {t.value}
          </button>
        ))}
      </div>
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
          🖼️ 图片 ({images.length}/{MAX_IMAGES})
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          hidden
          onChange={onPickImages}
        />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={submitting || !content.trim()}
          onClick={handleSubmit}
        >
          {submitting ? '保存中…' : '📝 记录'}
        </button>
      </div>
    </div>
  )
}

// 便利贴旋转角度：根据 id 哈希生成一个 -3 ~ 3 度的微旋转
function stickyRotation(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  return (Math.abs(hash) % 7) - 3 // -3 ~ +3
}

function PostCard({ post, onDelete, onTogglePin, onEdit, canModerate, busy }) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [editTag, setEditTag] = useState(post.tag || '其他')
  const ti = tagInfo(post.tag)
  const rotation = stickyRotation(post.id)

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return
    await onEdit(post.id, { content: editContent, tag: editTag })
    setEditing(false)
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setEditContent(post.content)
    setEditTag(post.tag || '其他')
  }

  return (
    <article
      className={`journal-sticky ${post.pinned ? 'journal-sticky-pinned' : ''}`}
      style={{
        '--sticky-bg': `${ti.color}12`,
        '--sticky-accent': ti.color,
        '--sticky-rotate': `${rotation}deg`,
      }}
    >
      {/* 顶部胶带效果 */}
      <div className="journal-sticky-tape" />

      {/* 置顶标记 */}
      {post.pinned && <div className="journal-sticky-pin">📌</div>}

      {/* 标签 + 时间 */}
      <div className="journal-sticky-head">
        <span className="journal-sticky-tag" style={{ background: `${ti.color}25`, color: ti.color }}>
          {ti.icon} {post.tag}
        </span>
        <time className="journal-sticky-time">{formatTime(post.created_at)}</time>
      </div>

      {editing ? (
        <div className="journal-edit-form">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value.slice(0, MAX_CONTENT))}
            rows={3}
            maxLength={MAX_CONTENT}
            autoFocus
          />
          <div className="journal-tag-picker" style={{ margin: '8px 0' }}>
            {TAGS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`journal-tag-chip ${editTag === t.value ? 'journal-tag-active' : ''}`}
                style={{
                  '--tag-color': t.color,
                  borderColor: editTag === t.value ? t.color : 'var(--border)',
                  background: editTag === t.value ? `${t.color}15` : 'transparent',
                  color: editTag === t.value ? t.color : 'var(--ink-muted)',
                }}
                onClick={() => setEditTag(t.value)}
              >
                {t.icon} {t.value}
              </button>
            ))}
          </div>
          <div className="journal-sticky-actions">
            <button type="button" className="journal-sticky-btn" onClick={handleSaveEdit} disabled={busy}>保存</button>
            <button type="button" className="journal-sticky-btn journal-sticky-btn-ghost" onClick={handleCancelEdit}>取消</button>
          </div>
        </div>
      ) : (
        <>
          <p className="journal-sticky-content">{post.content}</p>
          <ImageGrid images={post.images} />
          <div className="journal-sticky-actions">
            <button
              type="button"
              className="journal-sticky-btn"
              onClick={() => onTogglePin(post.id, !post.pinned)}
              disabled={busy}
            >
              {post.pinned ? '取消置顶' : '📌 置顶'}
            </button>
            <button
              type="button"
              className="journal-sticky-btn"
              onClick={() => {
                setEditing(true)
                setEditContent(post.content)
                setEditTag(post.tag || '其他')
              }}
            >
              ✏️ 编辑
            </button>
            {canModerate && (
              <button
                type="button"
                className="journal-sticky-btn journal-sticky-btn-danger"
                disabled={busy}
                onClick={() => onDelete(post.id)}
              >
                🗑️
              </button>
            )}
          </div>
        </>
      )}
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

  const submitPost = async ({ content, images, tag }) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('content', content.trim())
      fd.append('tag', tag)
      for (const file of images) fd.append('images', file)
      await createGuestbookPost(fd)
      showToast('备忘已记录', 'success')
      await refresh(1)
    } catch (err) {
      showToast(err.message || '记录失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeletePost = async (postId) => {
    if (!window.confirm('确定删除这条备忘？')) return
    setBusy(true)
    try {
      await deleteGuestbookPost(postId)
      showToast('备忘已删除', 'success')
      await refresh(page)
    } catch (err) {
      showToast(err.message || '删除失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePin = async (postId, pinned) => {
    setBusy(true)
    try {
      await updateGuestbookPost(postId, { pinned })
      showToast(pinned ? '已置顶' : '已取消置顶', 'success')
      await refresh(page)
    } catch (err) {
      showToast(err.message || '操作失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleEdit = async (postId, data) => {
    setBusy(true)
    try {
      await updateGuestbookPost(postId, data)
      showToast('已更新', 'success')
      await refresh(page)
    } catch (err) {
      showToast(err.message || '更新失败', 'error')
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
          <h3>📝 写一条备忘</h3>
          <p className="muted">
            共 {stats.post_count} 条备忘 · 最多 {MAX_CONTENT} 字 · 最多 {MAX_IMAGES} 张图
          </p>
        </div>
        <ComposeBox
          placeholder="记录灵感、待办事项、写作进度…"
          username={username}
          onSubmit={submitPost}
          submitting={busy}
        />
      </section>

      {loading ? (
        <p className="muted guestbook-loading">加载中…</p>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>还没有备忘</h3>
          <p>记下你的第一条创作灵感或待办事项吧。</p>
        </div>
      ) : (
        <div className="journal-wall">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handleDeletePost}
              onTogglePin={handleTogglePin}
              onEdit={handleEdit}
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
