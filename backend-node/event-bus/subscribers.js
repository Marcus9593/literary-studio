import fs from 'fs';
import { on } from './bus.js';
import { EVENTS } from './bus.js';
import { indexIfStale } from '../memory/retriever.js';
import { runReview } from '../measurement/review-facade.js';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import { afterChapterWritten } from '../agents/chief-editor/index.js';
import { runQuickSync, QUICK_CHAPTER_DEFAULT } from '../story-kb/rebuild.js';
import { verifyAfterWrite } from '../story-verify/index.js';
import { createVersion } from '../versions/version-service.js';

export function registerEventSubscribers() {
  on(EVENTS.PROJECT_UPDATED, async ({ projectId }) => {
    if (!projectId) return;
    await indexIfStale(projectId);
  });

  on(EVENTS.WRITE_FINISHED, async ({ projectId, title, filename, chapter }) => {
    if (!projectId) return;
    try {
      createVersion(projectId, {
        title: title ? `写稿完成 · ${title}` : '写稿完成自动版本',
        notes: 'AI 写稿完成后自动保存',
        type: 'auto_write',
      });
    } catch (err) {
      console.error('[event-bus] auto version failed:', err.message);
    }
    try {
      const chapters = storage.listChapters(projectId);
      const ch = chapters.find((c) => c.filename === filename) || chapters[chapters.length - 1];
      if (ch) {
        let content = '';
        try {
          const fp = storage.resolveManuscriptPath(projectId, ch.filename);
          content = decodeBuffer(fs.readFileSync(fp));
        } catch {}
        await afterChapterWritten(projectId, {
          filename: ch.filename,
          title: ch.title,
          content,
        });
      }
    } catch (err) {
      console.error('[event-bus] afterChapterWritten failed:', err.message);
    }
    await indexIfStale(projectId);
    try {
      runQuickSync(projectId, { latestChapters: QUICK_CHAPTER_DEFAULT });
    } catch (err) {
      console.error('[event-bus] quick sync failed:', err.message);
    }
    try {
      if (chapter != null) {
        verifyAfterWrite(projectId, { chapter, filename, title });
      }
    } catch (err) {
      console.error('[event-bus] verify after write failed:', err.message);
    }
  });

  on(EVENTS.WORKFLOW_FINISHED, async ({ projectId }) => {
    if (!projectId) return;
    try {
      runReview(projectId);
    } catch (err) {
      console.error('[event-bus] review after workflow failed:', err.message);
    }
  });

  on(EVENTS.MESSAGE_RECEIVED, async ({ projectId, role }) => {
    if (role === 'assistant' && projectId) {
      await indexIfStale(projectId);
    }
  });
}

export { EVENTS };
