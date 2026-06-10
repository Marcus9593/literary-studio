/**
 * Story OS 三层门面（Architecture Refactor Sprint 1）
 *
 * 新代码请优先：`import * as storyOs from '../story-os/index.js'`
 * 旧路径（story-planner/、story-tasks/ 等）仍可用，将逐步收敛到此入口。
 *
 * planner/     — 推进：Goal, Roadmap, Tasks
 * diagnosis/   — 诊断：Actions
 * measurement/ — 测量：Review, Verify, Metrics（Health = UI 聚合）
 */
export * as planner from './planner/index.js';
export * as diagnosis from './diagnosis/index.js';
export * as measurement from './measurement/index.js';
