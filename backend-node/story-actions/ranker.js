/**
 * 今日创作建议排序（Top N）
 */
export function rankTodayActions(actionsDoc, { limit = 3 } = {}) {
  const items = [...(actionsDoc?.items || [])];
  items.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return items.slice(0, limit);
}

export function matchActionsForMessage(actionsDoc, message) {
  const msg = String(message || '');
  const items = actionsDoc?.items || [];

  if (/女主|女一|成长线|成长/.test(msg)) {
    const hit = items.find((a) => a.type === 'arc_enhance');
    if (hit) return [hit];
  }
  if (/冲突|张力|对抗|中期/.test(msg)) {
    const hit = items.find((a) => a.type === 'conflict_boost');
    if (hit) return [hit];
  }
  if (/伏笔|回收/.test(msg)) {
    const hit = items.find((a) => a.type === 'foreshadow_payoff');
    if (hit) return [hit];
  }

  return rankTodayActions(actionsDoc, { limit: 1 });
}
