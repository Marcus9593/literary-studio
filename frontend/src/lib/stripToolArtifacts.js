/** Hide tool-call XML that API models echo without executing. */

const TOOL_CALL_BLOCK = /<tool_call>[\s\S]*?<\/tool_call>/gi
const FUNCTION_TAG = /<function=[^>]+>[\s\S]*?<\/function>/gi
const LONE_TOOL_TAGS = /<\/?tool_call>|<\/?parameter[^>]*>|<\/?function[^>]*>/gi

export function stripModelToolArtifacts(text) {
  let out = String(text || '')
  if (!out.trim()) return out
  out = out.replace(TOOL_CALL_BLOCK, '')
  out = out.replace(FUNCTION_TAG, '')
  out = out.replace(LONE_TOOL_TAGS, '')
  return out.replace(/\n{3,}/g, '\n\n').trim()
}
