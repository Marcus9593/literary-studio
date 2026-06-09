export async function analyzeCharacter(ctx) {
  const { message, context, priorOutputs } = ctx;
  return {
    promptBlock: `## Workflow 步骤：角色分析

项目：${context.title}（${context.genre}）
已有角色/设定摘录：${context.settings_excerpt?.slice(0, 1200) || '（暂无）'}

请基于用户意图分析相关角色动机、关系与弧光，输出 3-5 条要点（不要写正文）。
${priorOutputs.length ? `\n前序步骤摘要：\n${priorOutputs.map((o) => o.summary || o.note || '').filter(Boolean).join('\n')}` : ''}

用户关注点：${message}`,
    summary: '角色分析完成',
  };
}
