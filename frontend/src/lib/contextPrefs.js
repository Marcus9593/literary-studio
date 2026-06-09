/** AI 请求上下文偏好（按项目存 localStorage） */
const KEY = 'wenjiang-context-prefs';

export const DEFAULT_CONTEXT_PREFS = {
  outline: true,
  settings: true,
  knowledge: true,
  rag: true,
  recent_chapters: true,
};

export function loadContextPrefs(projectId) {
  if (typeof localStorage === 'undefined' || !projectId) return { ...DEFAULT_CONTEXT_PREFS };
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_CONTEXT_PREFS, ...(all[projectId] || {}) };
  } catch {
    return { ...DEFAULT_CONTEXT_PREFS };
  }
}

export function saveContextPrefs(projectId, prefs) {
  if (typeof localStorage === 'undefined' || !projectId) return;
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    all[projectId] = { ...DEFAULT_CONTEXT_PREFS, ...prefs };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export const CONTEXT_PREF_LABELS = {
  outline: '大纲摘要',
  settings: '设定集',
  knowledge: '知识库摘要',
  rag: '向量检索',
  recent_chapters: '最近章节',
};
