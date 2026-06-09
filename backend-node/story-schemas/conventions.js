/**
 * Story 实体公约（V2.8）— 与 docs/architecture.md 同步
 *
 * Action  → 为什么做（diagnosis）
 * Task    → 做什么（title / type / chapter）
 * Plan    → 怎么做（steps / execution_prompt）
 */

export const ENTITY_ROLES = {
  action: 'why',
  task: 'what',
  plan: 'how',
};

/** Understanding 拥有 Current State；Goal 只声明 Target */
export const CURRENT_STATE_ARTIFACT = 'understanding/story_dna.json';

export const TASK_TYPES = {
  write_chapter: 'write_chapter',
  arc_step: 'arc_step',
  rewrite_chapter: 'rewrite_chapter',
  align_goal: 'align_goal',
};
