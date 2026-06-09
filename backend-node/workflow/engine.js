import STEP_REGISTRY from './steps/index.js';
import * as runtime from '../ai-runtime/runtime.js';

/**
 * Execute a multi-step Skill workflow.
 * Each step builds a prompt segment; final step streams through AI Runtime.
 */
export async function* executeWorkflow(ctx) {
  const {
    projectId,
    message,
    session,
    context,
    workflow,
    binding,
    options = {},
  } = ctx;

  const ws = (await import('../storage.js')).workspacePath(projectId);
  const stepIds = workflow.steps || [];
  const stepOutputs = [];

  yield { type: 'session_meta', claude_session_id: session.claude_session_id };

  for (let i = 0; i < stepIds.length; i++) {
    const stepId = stepIds[i];
    yield { type: 'status', status: 'thinking', step: stepId };

    const stepFn = STEP_REGISTRY[stepId];
    if (!stepFn) {
      stepOutputs.push({ step: stepId, note: `未知步骤 ${stepId}，已跳过` });
      continue;
    }

    const result = await stepFn({
      projectId,
      message,
      context,
      binding,
      priorOutputs: stepOutputs,
      isFinal: i === stepIds.length - 1,
    });
    stepOutputs.push({ step: stepId, ...result });
  }

  const finalPrompt = stepOutputs
    .map((o) => o.promptBlock)
    .filter(Boolean)
    .join('\n\n---\n\n');

  const composed = `${finalPrompt || ''}

---

用户消息：${message}`;

  for await (const evt of runtime.stream({
    prompt: composed,
    cwd: ws,
    allowedTools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
    sessionId: session.claude_session_id,
    resume: !!session.claude_session_id,
    onRunner: options.onRunner,
  })) {
    yield evt;
  }
}
