/** 与后端 storage.SESSION_SCOPE_PROJECT 一致 */
export const SESSION_SCOPE_PROJECT = '__project__'

export function sessionScopeLabel(session, chapters = []) {
  const fn = session?.bound_filename
  if (!fn || fn === SESSION_SCOPE_PROJECT) return '全书'
  const ch = chapters.find((c) => c.filename === fn)
  return ch?.title ? ch.title.replace(/\.md$/i, '') : fn.replace(/\.md$/i, '')
}

export function isChapterSession(session) {
  const fn = session?.bound_filename
  return !!fn && fn !== SESSION_SCOPE_PROJECT
}
