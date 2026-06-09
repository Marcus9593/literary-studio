/** @typedef {'claude' | 'openai' | 'gemini' | 'deepseek'} ProviderId */

/** @typedef {'content' | 'done' | 'error' | 'session_meta' | 'tool_call'} StreamEventType */

/**
 * @typedef {object} StreamEvent
 * @property {StreamEventType} type
 * @property {string} [text]
 * @property {string} [error]
 * @property {string} [claude_session_id]
 * @property {object} [toolCall]
 */

/**
 * @typedef {object} StreamRequest
 * @property {ProviderId} [provider]
 * @property {string} prompt
 * @property {string} cwd
 * @property {string[]} [allowedTools]
 * @property {string} [sessionId]
 * @property {boolean} [resume]
 * @property {(runner: { abort: () => void }) => void} [onRunner]
 */

/**
 * @typedef {object} GenerateRequest
 * @property {ProviderId} [provider]
 * @property {string} prompt
 * @property {string} cwd
 * @property {string[]} [allowedTools]
 */

export const DEFAULT_PROVIDER = /** @type {ProviderId} */ ('claude');

export const PROVIDER_IDS = /** @type {ProviderId[]} */ ([
  'claude',
  'http',
]);
