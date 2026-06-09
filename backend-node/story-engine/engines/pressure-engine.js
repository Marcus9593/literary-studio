import { countMarkers, minF, round1 } from './utils.js';

const SUSPENSE_MARKERS = [
  '!', '?!', 'suddenly', 'reveals', 'secret', 'danger', 'threat', 'escape', 'chase',
  '突然', '揭示', '秘密', '危险', '威胁', '逃跑', '追逐', '悬念', '紧张',
];

const EMOTION_MARKERS = [
  'cries', 'laughs', 'screams', 'whispers', 'trembles', 'rage', 'love', 'fear', 'hope', 'despair',
  '哭', '笑', '尖叫', '低语', '颤抖', '愤怒', '爱', '恐惧', '希望', '绝望', '心痛', '泪',
];

/**
 * Narrative pressure = suspense×0.4 + emotion×0.3 + pacing×0.3
 * @param {string} content
 * @param {number} [totalBeats=0]
 */
export function analyzePressure(content, totalBeats = 0) {
  const lines = String(content || '').split('\n');

  const suspense = minF(10, countMarkers(lines, SUSPENSE_MARKERS) * 0.5);
  const emotion = minF(10, countMarkers(lines, EMOTION_MARKERS) * 0.6);

  let sceneHeaders = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (trimmed.startsWith('#') || upper.startsWith('INT.') || upper.startsWith('EXT.')
      || trimmed.startsWith('第') && trimmed.includes('场')) {
      sceneHeaders += 1;
    }
  }
  const beats = totalBeats || 1;
  const pacing = minF(10, (sceneHeaders / beats) * 5);

  const overall = suspense * 0.4 + emotion * 0.3 + pacing * 0.3;

  let state = 'opening';
  if (overall >= 8) state = 'climax';
  else if (suspense > pacing && suspense > 5) state = 'rising';
  else if (pacing > suspense && pacing > 5) state = 'falling';
  else if (overall < 3) state = 'flat';

  const half = Math.floor(lines.length / 2);
  let direction = 'stable';
  if (half > 0) {
    const firstHalf = minF(10, countMarkers(lines.slice(0, half), SUSPENSE_MARKERS) * 0.5);
    const secondHalf = minF(10, countMarkers(lines.slice(half), SUSPENSE_MARKERS) * 0.5);
    const diff = secondHalf - firstHalf;
    if (diff > 1.5) direction = 'increasing';
    else if (diff < -1.5) direction = 'decreasing';
  }

  return {
    suspense: round1(suspense),
    emotion: round1(emotion),
    pacing: round1(pacing),
    overall: round1(overall),
    state,
    direction,
  };
}
