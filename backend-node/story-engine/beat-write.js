import * as storage from '../storage.js';
import { loadBeatOutline, saveBeatOutline } from './beat-outline-store.js';
import { loadCreatorContext } from './creator-context.js';
import { createPipelineRun } from '../storage/sqlite/repos/pipeline-repo.js';

/**
 * Build a write plan from beat outline + creator context for ChatPanel.triggerWrite.
 */
export function buildBeatWritePlan(projectId, unitIndex = 1) {
  const outline = loadBeatOutline(projectId, unitIndex);
  if (!outline?.beats?.length) {
    throw new Error('请先添加至少一个节拍');
  }

  const chapters = storage.listChapters(projectId);
  const nextChapter = chapters.length
    ? Math.max(...chapters.map((c) => c.number || 0)) + 1
    : unitIndex;

  const beatLines = outline.beats
    .map((b) => `${b.order}. [${b.scene_type || 'scene'}] ${b.title}: ${b.description || ''}`)
    .join('\n');

  let contextExcerpt = '';
  try {
    const ctx = loadCreatorContext(projectId, unitIndex);
    contextExcerpt = ctx.prompt?.slice(0, 3500) || '';
  } catch {
    contextExcerpt = '';
  }

  const execution_prompt = `【按节拍大纲写作】
单元：${unitIndex}
标题：${outline.title || `第${unitIndex}单元`}
说明：${outline.description || '按下列节拍顺序完成正文'}

节拍列表：
${beatLines}

创作要求：
1. 严格按节拍顺序展开，每个节拍对应一个场景或叙事段落
2. 遵守 Canon / 设定 / 角色声音约束
3. 段末保留悬念或情绪点

${contextExcerpt ? `---约束上下文---\n${contextExcerpt}` : ''}`;

  const pipeline = createPipelineRun(projectId, {
    unit_index: unitIndex,
    status: 'pending',
    beat_json: outline,
  });

  return {
    chapter: nextChapter,
    title: outline.title || `第${nextChapter}章`,
    outline: execution_prompt,
    unit_index: unitIndex,
    beats_count: outline.beats.length,
    pipeline_id: pipeline.id,
  };
}

export function linkBeatOutlineToPipeline(projectId, unitIndex, pipelineId) {
  const outline = loadBeatOutline(projectId, unitIndex);
  saveBeatOutline(projectId, unitIndex, { ...outline, last_pipeline_id: pipelineId });
  return outline;
}
