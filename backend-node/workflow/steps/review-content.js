export async function reviewContent(ctx) {
  const { message, context, priorOutputs } = ctx;
  return {
    promptBlock: `## Workflow 步骤：内容审稿

项目：${context.title}
最新稿：${context.latest_chapter_title || '无'}
最新正文摘录：${context.latest_chapter_excerpt?.slice(0, 2000) || '（暂无）'}

从节奏、人设一致性、AI 味套话、伏笔四个维度给出审稿意见（短评 + 可执行修改建议）。
${priorOutputs.length ? `\n前序步骤：\n${priorOutputs.map((o) => o.summary || '').filter(Boolean).join('\n')}` : ''}

用户要求：${message}`,
    summary: '审稿分析完成',
  };
}
