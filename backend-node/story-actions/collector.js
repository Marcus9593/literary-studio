import { buildArcAction } from '../story-understanding/arc-analyzer.js';
import { buildConflictAction } from '../story-understanding/conflict-analyzer.js';
import { buildForeshadowActions } from '../story-understanding/foreshadow-analyzer.js';

/**
 * 从各 Analyzer 输出收集 Action，写入独立 actions/actions.json
 */
export function collectActions({ arcs, conflicts, foreshadowResult }) {
  const actions = [];
  const seen = new Set();

  const push = (action) => {
    if (!action || seen.has(action.title)) return;
    seen.add(action.title);
    actions.push(action);
  };

  for (const arc of arcs?.items || []) {
    push(buildArcAction(arc));
  }

  for (const conflict of conflicts?.items || []) {
    push(buildConflictAction(conflict));
  }

  for (const action of buildForeshadowActions(foreshadowResult)) {
    push(action);
  }

  return actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}
