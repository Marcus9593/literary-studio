/**
 * Extract ```write_plan JSON blocks from assistant messages.
 */
export function extractWritePlan(content) {
  if (!content) return null;
  const match = content.match(/```write_plan\s*([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const plan = JSON.parse(match[1].trim());
    if (!plan || typeof plan !== 'object') return null;
    return plan;
  } catch {
    return null;
  }
}

export function stripWritePlan(content) {
  if (!content) return '';
  return content.replace(/```write_plan[\s\S]*?```/gi, '').trim();
}
