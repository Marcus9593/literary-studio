import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as guestbook from './guestbook-service.js';
import { requireAdmin } from '../auth/middleware.js';
import { isSuperAdmin } from '../auth/permissions.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: guestbook.MAX_IMAGES_PER_ENTRY,
  },
});

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    res.json({
      ...guestbook.listPosts({ page, limit, forModerator: isSuperAdmin(req.user) }),
      stats: guestbook.getGuestbookStats(),
      limits: {
        max_content: guestbook.MAX_CONTENT_LENGTH,
        max_images: guestbook.MAX_IMAGES_PER_ENTRY,
        max_author: guestbook.MAX_AUTHOR_LENGTH,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function authorFromRequest(user, body) {
  return guestbook.resolveGuestbookAuthor(user, {
    anonymous: guestbook.isAnonymousFlag(body?.anonymous),
  });
}

router.post('/', upload.array('images', guestbook.MAX_IMAGES_PER_ENTRY), (req, res) => {
  try {
    const images = guestbook.saveUploadedImages(req.files || []);
    const identity = authorFromRequest(req.user, req.body);
    const post = guestbook.createPost({
      ...identity,
      content: req.body?.content,
      images,
    });
    res.status(201).json(post);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post(
  '/:postId/replies',
  upload.array('images', guestbook.MAX_IMAGES_PER_ENTRY),
  (req, res) => {
    try {
      const images = guestbook.saveUploadedImages(req.files || []);
      const parent = req.body?.parent_reply_id ? String(req.body.parent_reply_id) : null;
      const identity = authorFromRequest(req.user, req.body);
      const result = guestbook.addReply(req.params.postId, {
        ...identity,
        content: req.body?.content,
        images,
        parent_reply_id: parent,
      });
      res.status(201).json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  },
);

router.delete('/:postId', requireAdmin, (req, res) => {
  try {
    res.json(guestbook.deletePost(req.params.postId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:postId/replies/:replyId', requireAdmin, (req, res) => {
  try {
    res.json(guestbook.deleteReply(req.params.postId, req.params.replyId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/media/:filename', (req, res) => {
  try {
    const full = guestbook.resolveMediaPath(req.params.filename);
    if (!full) {
      res.status(404).json({ error: '图片不存在' });
      return;
    }
    const ext = path.extname(full).toLowerCase();
    res.type(MIME_TYPES[ext] || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(full);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
