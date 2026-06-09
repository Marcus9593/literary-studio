import { CURRENT_STATE_ARTIFACT } from './conventions.js';

/**
 * Goal 不拥有 Current State 真相；只读 Understanding 或 summary/ref
 * @param {object|null} goal
 * @param {object|null} [understandingBundle]
 */
export function resolveGoalCurrentStateSummary(goal, understandingBundle = null) {
  if (!goal) {
    const dna = understandingBundle?.story_dna;
    return dna?.one_liner?.trim() || '';
  }
  if (goal.current_state_summary?.trim()) {
    return goal.current_state_summary.trim();
  }
  const dna = understandingBundle?.story_dna;
  if (dna?.one_liner?.trim()) return dna.one_liner.trim();
  return '';
}

export function resolveGoalCurrentStateRef(goal) {
  return goal?.current_state_ref || {
    artifact: CURRENT_STATE_ARTIFACT,
    fields: ['one_liner', 'core_engine', 'core_theme'],
  };
}

/** 从 Goal 对象剥离已废弃的 current_state 字段（API 输出用） */
export function stripDeprecatedGoalFields(goal) {
  if (!goal || typeof goal !== 'object') return goal;
  const { current_state: _omit, ...rest } = goal;
  return rest;
}
