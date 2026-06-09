export async function generateContent(ctx) {
  const { message, context, priorOutputs, isFinal } = ctx;
  const prior = priorOutputs
    .map((o) => o.promptBlock)
    .filter(Boolean)
    .join('\n\n');

  return {
    promptBlock: `${prior ? `${prior}\n\n---\n\n` : ''}## Workflow 步骤：生成/执行

项目：${context.title}（${context.creation_mode_label}）
${isFinal ? '综合以上分析，按用户指令执行（讨论则讨论，写稿则写入对应目录并汇报）。' : '准备生成内容。'}

用户指令：${message}`,
    summary: '进入生成阶段',
  };
}
