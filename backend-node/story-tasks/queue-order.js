/**
 * Planner 决策：任务队列顺序（Scheduler 不得重排，只按此顺序装箱）
 */

const TYPE_ORDER = {
  write_chapter: 0,
  arc_step: 1,
  rewrite_chapter: 2,
  align_goal: 9,
};

/**
 * 为 Roadmap 分解出的任务分配 planner_order（章节升序，同章 write → arc → conflict）
 */
export function assignPlannerOrder(items) {
  let order = 0;
  const byChapter = new Map();

  for (const t of items) {
    const ch = t.chapter == null ? 99999 : t.chapter;
    if (!byChapter.has(ch)) byChapter.set(ch, []);
    byChapter.get(ch).push(t);
  }

  const chapters = [...byChapter.keys()].sort((a, b) => a - b);
  const sorted = [];

  for (const ch of chapters) {
    const group = byChapter.get(ch);
    group.sort(
      (a, b) => (TYPE_ORDER[a.type] ?? 5) - (TYPE_ORDER[b.type] ?? 5),
    );
    for (const t of group) {
      sorted.push({ ...t, planner_order: order++ });
    }
  }

  return sorted;
}

/**
 * 按 Planner 队列顺序取待办（公约 3：Scheduler 不重排）
 */
export function sortByPlannerOrder(items, { status = 'todo' } = {}) {
  return [...(items || [])]
    .filter((t) => !status || t.status === status)
    .sort((a, b) => {
      const oa = a.planner_order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.planner_order ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return (a.chapter || 0) - (b.chapter || 0);
    });
}

/**
 * Planner 认定的「下一项必做」（队列首项 todo）
 */
export function getMandatoryNextTask(tasksDoc) {
  const ordered = sortByPlannerOrder(tasksDoc?.items || [], { status: 'todo' });
  return ordered[0] || null;
}
