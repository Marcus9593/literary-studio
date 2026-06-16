import fs from 'fs';
import path from 'path';
import { workspacePath } from './projects.js';

// ── Chat History ──

export function chatPath(projectId) {
  return path.join(workspacePath(projectId), '.webnovel', 'chat.json');
}

export function loadChatHistory(projectId) {
  const p = chatPath(projectId);
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return (data.messages || []).filter(m => ['user', 'assistant'].includes(m.role) && m.content);
  } catch { return []; }
}

export function saveChatHistory(projectId, messages) {
  const trimmed = messages.slice(-40);
  const p = chatPath(projectId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ messages: trimmed }, null, 2), 'utf-8');
  return trimmed;
}

export function clearChatHistory(projectId) {
  const p = chatPath(projectId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}