export async function analyzeOutline(ctx) {
  const { message, context, priorOutputs } = ctx;
  return {
    promptBlock: `## Workflow 步骤：大纲/结构分析

项目：${context.title}
大纲摘录：${context.outline_excerpt?.slice(0, 1500) || '（暂无大纲）'}
已写：${context.chapter_count} ${context.unit_label}

对照大纲检查当前进度、结构缺口与下一节拍建议（条目式，不写正文）。
${priorOutputs.length ? `\n前序分析：\n${priorOutputs.map((o) => o.summary || '').filter(Boolean).join('\n')}` : ''}

用户问题：${message}`,
    summary: '大纲分析完成',
  };
}
