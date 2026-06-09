import { getKnowledgePromptBlock } from '../../story-kb/sync.js';
import { getSummaryPromptBlock } from '../../story-summaries/store.js';
import { getUnderstandingPromptBlock } from '../../story-understanding/summary-builder.js';
import { loadUnderstandingBundle } from '../../story-understanding/store.js';
import { loadActions } from '../../story-actions/store.js';

export function buildStoryContextBlocks(projectId) {
  const blocks = [];
  try {
    const summary = getSummaryPromptBlock(projectId);
    if (summary) blocks.push(summary);
  } catch {}
  try {
    const bundle = loadUnderstandingBundle(projectId);
    const actions = loadActions(projectId);
    const understanding = getUnderstandingPromptBlock(bundle, actions);
    if (understanding) blocks.push(understanding);
  } catch {}
  try {
    const kb = getKnowledgePromptBlock(projectId);
    if (kb) blocks.push(kb);
  } catch {}
  return blocks;
}
