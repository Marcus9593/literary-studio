import * as steps from './steps/index.js';
import * as runtime from '../ai-runtime/runtime.js';

/**
 * Run a single workflow step (non-streaming analysis).
 */
export async function runStep(stepId, ctx) {
  const fn = steps[stepId];
  if (!fn) throw new Error(`未知 workflow 步骤: ${stepId}`);
  return fn({ ...ctx, isFinal: false });
}

/**
 * Stream a prompt through AI Runtime (used by engine).
 */
export async function* streamStepPrompt(prompt, cwd, options = {}) {
  for await (const evt of runtime.stream({
    prompt,
    cwd,
    allowedTools: options.allowedTools || ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
    sessionId: options.sessionId,
    resume: options.resume,
    onRunner: options.onRunner,
  })) {
    yield evt;
  }
}

export { steps };
