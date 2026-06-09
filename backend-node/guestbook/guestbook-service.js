import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.resolve(process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data'));
const GUESTBOOK_PATH = path.join(DATA_DIR, 'guestbook.json');
const MEDIA_DIR = path.join(DATA_DIR, 'guestbook-media');

export const MAX_CONTENT_LENGTH = 1000;
export const MAX_AUTHOR_LENGTH = 32;
export const ANONYMOUS_AUTHOR = '匿名用户';
export const MAX_IMAGES_PER_ENTRY = 4;
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function loadStore() {
  if (!fs.existsSync(GUESTBOOK_PATH)) {
    return { posts: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(GUESTBOOK_PATH, 'utf-8'));
    return { posts: Array.isArray(raw.posts) ? raw.posts : [] };
  } catch {
    return { posts: [] };
  }
}

function saveStore(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(GUESTBOOK_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function sanitizeAuthor(author) {
  const name = String(author || '').trim().slice(0, MAX_AUTHOR_LENGTH);
  if (!name) throw new Error('缺少用户名');
  return name;
}

export function isAnonymousFlag(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function resolveGuestbookAuthor(user, { anonymous = false } = {}) {
  const username = String(user?.username || '').trim();
  const userId = String(user?.id || '').trim();
  if (!username || !userId) throw new Error('请先登录');
  if (anonymous) {
    return {
      author: ANONYMOUS_AUTHOR,
      anonymous: true,
      user_id: userId,
      author_username: username,
    };
  }
  return {
    author: username,
    anonymous: false,
    user_id: userId,
    author_username: username,
  };
}

function validateContent(content) {
  const text = String(content || '').trim();
  if (!text) throw new Error('留言内容不能为空');
  if (text.length > MAX_CONTENT_LENGTH) {
    throw new Error(`留言最多 ${MAX_CONTENT_LENGTH} 字`);
  }
  return text;
}

function extFromMime(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return map[mime] || '.bin';
}

export function saveUploadedImages(files = []) {
  if (!files.length) return [];
  if (files.length > MAX_IMAGES_PER_ENTRY) {
    throw new Error(`最多上传 ${MAX_IMAGES_PER_ENTRY} 张图片`);
  }
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const images = [];
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new Error(`不支持的图片格式：${file.mimetype}`);
    }
    const id = crypto.randomUUID();
    const filename = `${id}${extFromMime(file.mimetype)}`;
    const full = path.join(MEDIA_DIR, filename);
    fs.writeFileSync(full, file.buffer);
    images.push({
      id,
      filename,
      url: `/api/guestbook/media/${filename}`,
      size: file.size,
      mime: file.mimetype,
    });
  }
  return images;
}

export function resolveMediaPath(filename) {
  const safe = path.basename(String(filename || ''));
  if (!safe || safe.includes('..')) return null;
  const full = path.join(MEDIA_DIR, safe);
  if (!fs.existsSync(full)) return null;
  return full;
}

export function listPosts({ page = 1, limit = 20, forModerator = false } = {}) {
  const data = loadStore();
  const sorted = [...data.posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const total = sorted.length;
  const p = Math.max(1, page);
  const lim = Math.min(Math.max(limit, 1), 50);
  const start = (p - 1) * lim;
  const items = sorted.slice(start, start + lim).map((post) => formatPost(post, { forModerator }));
  return { items, total, page: p, limit: lim };
}

function formatReply(reply, { forModerator = false } = {}) {
  const base = {
    id: reply.id,
    author: reply.author,
    content: reply.content,
    images: reply.images || [],
    parent_reply_id: reply.parent_reply_id || null,
    created_at: reply.created_at,
    anonymous: Boolean(reply.anonymous),
  };
  if (forModerator && reply.anonymous && reply.author_username) {
    base.moderation = { username: reply.author_username };
  }
  return base;
}

function formatPost(post, { forModerator = false } = {}) {
  const formatted = {
    id: post.id,
    author: post.author,
    content: post.content,
    images: post.images || [],
    created_at: post.created_at,
    anonymous: Boolean(post.anonymous),
    reply_count: post.replies?.length || 0,
    replies: [...(post.replies || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ).map((r) => formatReply(r, { forModerator })),
  };
  if (forModerator && post.anonymous && post.author_username) {
    formatted.moderation = { username: post.author_username };
  }
  return formatted;
}

export function createPost({
  author,
  content,
  images = [],
  anonymous = false,
  user_id = '',
  author_username = '',
}) {
  const text = validateContent(content);
  const post = {
    id: crypto.randomUUID(),
    author: sanitizeAuthor(author),
    content: text,
    images: images.slice(0, MAX_IMAGES_PER_ENTRY),
    anonymous: Boolean(anonymous),
    user_id: String(user_id || ''),
    author_username: String(author_username || author || ''),
    created_at: new Date().toISOString(),
    replies: [],
  };
  const data = loadStore();
  data.posts.push(post);
  saveStore(data);
  return formatPost(post);
}

export function addReply(postId, {
  author,
  content,
  images = [],
  parent_reply_id = null,
  anonymous = false,
  user_id = '',
  author_username = '',
}) {
  const text = validateContent(content);
  const data = loadStore();
  const post = data.posts.find((p) => p.id === postId);
  if (!post) throw new Error('留言不存在');

  if (parent_reply_id) {
    const parent = (post.replies || []).find((r) => r.id === parent_reply_id);
    if (!parent) throw new Error('被回复的评论不存在');
  }

  const reply = {
    id: crypto.randomUUID(),
    author: sanitizeAuthor(author),
    content: text,
    images: images.slice(0, MAX_IMAGES_PER_ENTRY),
    parent_reply_id: parent_reply_id || null,
    anonymous: Boolean(anonymous),
    user_id: String(user_id || ''),
    author_username: String(author_username || author || ''),
    created_at: new Date().toISOString(),
  };
  post.replies = post.replies || [];
  post.replies.push(reply);
  saveStore(data);
  return { post: formatPost(post), reply };
}

export function getGuestbookStats() {
  const data = loadStore();
  const replyTotal = data.posts.reduce((n, p) => n + (p.replies?.length || 0), 0);
  return {
    post_count: data.posts.length,
    reply_count: replyTotal,
  };
}

function deleteImageFiles(images = []) {
  for (const img of images) {
    const filename = path.basename(String(img?.filename || ''));
    if (!filename) continue;
    try {
      const full = path.join(MEDIA_DIR, filename);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {
      /* skip */
    }
  }
}

function collectReplyDescendantIds(replies, rootId) {
  const ids = new Set([rootId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const r of replies) {
      if (r.parent_reply_id && ids.has(r.parent_reply_id) && !ids.has(r.id)) {
        ids.add(r.id);
        expanded = true;
      }
    }
  }
  return ids;
}

export function deletePost(postId) {
  const data = loadStore();
  const idx = data.posts.findIndex((p) => p.id === postId);
  if (idx < 0) throw new Error('留言不存在');
  const post = data.posts[idx];
  deleteImageFiles(post.images);
  for (const reply of post.replies || []) {
    deleteImageFiles(reply.images);
  }
  data.posts.splice(idx, 1);
  saveStore(data);
  return { status: 'deleted', stats: getGuestbookStats() };
}

export function deleteReply(postId, replyId) {
  const data = loadStore();
  const post = data.posts.find((p) => p.id === postId);
  if (!post) throw new Error('留言不存在');
  const replies = post.replies || [];
  const target = replies.find((r) => r.id === replyId);
  if (!target) throw new Error('回复不存在');

  const removeIds = collectReplyDescendantIds(replies, replyId);
  const removed = replies.filter((r) => removeIds.has(r.id));
  for (const reply of removed) {
    deleteImageFiles(reply.images);
  }
  post.replies = replies.filter((r) => !removeIds.has(r.id));
  saveStore(data);
  return { post: formatPost(post), stats: getGuestbookStats() };
}
