import {
  addMemoryFactsBatch,
  upsertNarrativeSummary,
} from '../storage/sqlite/repos/memory-facts-repo.js';

const RELATIONSHIP_MARKERS = [
  { re: /trust|believe|信任|相信/i, value: 'trusting' },
  { re: /betray|lied|背叛|欺骗/i, value: 'betrayed' },
  { re: /love|喜欢|爱/i, value: 'affection' },
];

function isSceneHeader(line) {
  const upper = line.trim().toUpperCase();
  return upper.startsWith('## ')
    || upper.startsWith('INT.')
    || upper.startsWith('EXT.')
    || /^第[一二三四五六七八九十百\d]+[章节场]/.test(line.trim());
}

/**
 * Extract verifiable facts only — no speculation (AWR principle).
 */
export function extractFactsFromContent(content, { unitIndex = 1, characterNames = [] } = {}) {
  const lines = String(content || '').split('\n');
  const facts = [];
  let currentScene = 'Scene 1';
  const seen = new Set();

  const push = (fact) => {
    const key = `${fact.category}:${fact.fact}:${fact.source_scene}`;
    if (seen.has(key)) return;
    seen.add(key);
    facts.push(fact);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();

    if (isSceneHeader(trimmed)) {
      currentScene = trimmed;
      continue;
    }

    if (upper.startsWith('INT.') || upper.startsWith('EXT.')) {
      for (const name of characterNames) {
        if (content.toLowerCase().includes(name.toLowerCase())) {
          push({
            unit_index: unitIndex,
            category: 'world',
            fact: `场景位置：${trimmed}`,
            characters: [name],
            confidence: 1.0,
            source_scene: currentScene,
          });
        }
      }
    }

    const lower = trimmed.toLowerCase();
    for (const name of characterNames) {
      if (!lower.includes(name.toLowerCase())) continue;
      for (const marker of RELATIONSHIP_MARKERS) {
        if (marker.re.test(trimmed)) {
          push({
            unit_index: unitIndex,
            category: 'relationship',
            fact: `${name} 关系状态：${marker.value}`,
            characters: [name],
            confidence: 1.0,
            source_scene: currentScene,
          });
        }
      }
      if (/knows|learned|discovered|知道|发现|得知/i.test(trimmed)) {
        const snippet = trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
        push({
          unit_index: unitIndex,
          category: 'plot',
          fact: `${name} 获知信息：${snippet}`,
          characters: [name],
          confidence: 1.0,
          source_scene: currentScene,
        });
      }
    }
  }

  return facts;
}

function buildRollingSummary(content, { title, unitIndex }) {
  const plain = content.replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  const excerpt = plain.length > 400 ? `${plain.slice(0, 400)}…` : plain;
  const label = title || `第 ${unitIndex} 单元`;
  return `${label}：${excerpt}`;
}

/**
 * Persist structured memory after verify pass / plan complete.
 */
export function syncMemoryAfterApproval(projectId, {
  content,
  unitIndex = 1,
  characterNames = [],
  title,
  filename,
} = {}) {
  if (!content?.trim()) return { facts: [], summary: null };

  const facts = extractFactsFromContent(content, { unitIndex, characterNames });
  const savedFacts = facts.length
    ? addMemoryFactsBatch(projectId, facts)
    : [];

  const summaryText = buildRollingSummary(content, { title, unitIndex });
  const summary = summaryText
    ? upsertNarrativeSummary(projectId, unitIndex, summaryText)
    : null;

  return {
    facts: savedFacts,
    summary,
    filename,
    unit_index: unitIndex,
  };
}
