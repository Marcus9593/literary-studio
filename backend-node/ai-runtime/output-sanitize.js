/** Strip tool-call artifacts that API models sometimes echo without executing. */

const TOOL_CALL_BLOCK = /<tool_call>[\s\S]*?<\/tool_call>/gi;
const FUNCTION_TAG = /<function=[^>]+>[\s\S]*?<\/function>/gi;
const INVOKE_BLOCK = /<invoke[\s\S]*?<\/invoke>/gi;
const INVOKE_MANGLED = /<invokename="[^"]*"[\s\S]*?(?:<\/invoke>|$)/gi;
const LONE_TOOL_TAGS = /<\/?tool_call>|<\/?parameter[^>]*>|<\/?function[^>]*>|<\/?invoke[^>]*>/gi;
const META_PREAMBLE = /^[\s\S]{0,400}?(我需要先读取|让我先读取|按照要求开始操作|I'll read the skill)/i;

export function stripModelToolArtifacts(text) {
  let out = String(text || '');
  if (!out.trim()) return out;

  out = out.replace(TOOL_CALL_BLOCK, '');
  out = out.replace(FUNCTION_TAG, '');
  out = out.replace(INVOKE_BLOCK, '');
  out = out.replace(INVOKE_MANGLED, '');
  out = out.replace(LONE_TOOL_TAGS, '');
  out = out.replace(META_PREAMBLE, '');
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  return out;
}

export function containsToolCallArtifacts(text) {
  const s = String(text || '');
  return /<tool_call>|<function=\w+>|<invoke|invokename=/i.test(s)
    || META_PREAMBLE.test(s);
}

export function isCorruptedManuscript(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (containsToolCallArtifacts(s)) return true;
  if (s.length < 80 && /skill|file_path|Read>/i.test(s)) return true;
  return false;
}

export function sanitizeManuscriptForSave(text) {
  const cleaned = stripModelToolArtifacts(text);
  if (isCorruptedManuscript(cleaned)) {
    throw new Error('正文含 AI 工具调用残留，已拒绝保存。请重新生成或手动编辑后再保存。');
  }
  return cleaned;
}
