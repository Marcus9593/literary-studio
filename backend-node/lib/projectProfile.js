/** 项目类型与创作模式 — 前后端共享语义 */

export const WORK_TYPES = {
  novel_long: { label: '长篇小说', unit: '章', unitPlural: '章' },
  novel_short: { label: '短篇小说', unit: '篇', unitPlural: '篇' },
  webnovel: { label: '网文连载', unit: '章', unitPlural: '章' },
  screenplay_film: { label: '电影剧本', unit: '场', unitPlural: '场' },
  screenplay_series: { label: '剧集剧本', unit: '集', unitPlural: '集' },
  web_short: { label: '短视频脚本', unit: '条', unitPlural: '条' },
  general: { label: '通用创作', unit: '稿', unitPlural: '稿' },
};

export const CREATION_MODES = {
  scratch: { label: '从零开始', description: '新建大纲与正文，逐步搭建' },
  continue: { label: '续写半成品', description: '在已有文稿基础上接着写' },
  rewrite: { label: '重新创作', description: '保留旧稿作参考，另起修订稿' },
};

export const WORK_TYPE_IDS = Object.keys(WORK_TYPES);
export const CREATION_MODE_IDS = Object.keys(CREATION_MODES);

export function normalizeWorkType(v) {
  return WORK_TYPE_IDS.includes(v) ? v : 'novel_long';
}

export function normalizeCreationMode(v) {
  return CREATION_MODE_IDS.includes(v) ? v : 'scratch';
}

export function unitLabel(workType, count = 1) {
  const p = WORK_TYPES[normalizeWorkType(workType)];
  return count === 1 ? p.unit : p.unitPlural;
}

export function manuscriptDirForMode(creationMode) {
  return creationMode === 'rewrite' ? '试验稿' : '正文';
}
