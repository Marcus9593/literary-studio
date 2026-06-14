function extractDialogue(line) {
  const parts = line.split(':');
  if (parts.length < 2) {
    const cn = line.split('：');
    if (cn.length < 2) return '';
    return cn.slice(1).join('：').trim();
  }
  return parts.slice(1).join(':').trim();
}

function checkDialogueMatch(dialogue, character, dna) {
  const lower = dialogue.toLowerCase();
  const voice = String(character.voice || character.voice_description || '').toLowerCase();
  const formality = String(dna?.formality || '').toLowerCase();
  const tone = String(dna?.tone || '').toLowerCase();

  const issues = [];

  if ((voice.includes('formal') || formality === 'formal')
    && (lower.includes('gonna') || lower.includes("ain't") || lower.includes('咋') || lower.includes('咱'))) {
    issues.push(`${character.name} 使用非正式用语，但角色设定为正式口吻`);
  }

  // Chinese text has no spaces, so use character count for length check
  const isChineseText = (dialogue.match(/[一-鿿]/g) || []).length > dialogue.length * 0.3;
  const dialogueLen = isChineseText ? dialogue.length : dialogue.split(/\s+/).length;
  const lengthThreshold = isChineseText ? 200 : 30;
  if ((voice.includes('casual') || formality === 'casual') && dialogueLen > lengthThreshold) {
    issues.push(`${character.name} 对白过长，与轻松口语人设不符`);
  }

  if (dna?.forbidden_words?.length) {
    for (const w of dna.forbidden_words) {
      if (w && dialogue.includes(w)) {
        issues.push(`${character.name} 使用了禁用词「${w}」`);
      }
    }
  }

  if (tone === 'cold' && (dialogue.includes('亲爱的') || dialogue.includes('宝贝'))) {
    issues.push(`${character.name} 语气偏冷，但对白过于亲昵`);
  }

  return issues;
}

/**
 * Build voice guidance prompt section.
 * @param {Array} characters
 * @param {Record<string, object>} [dnaByCharId]
 */
export function buildVoiceContext(characters = [], dnaByCharId = {}) {
  if (!characters.length) return '';

  let result = 'CHARACTER VOICE GUIDELINES:\n\n';
  for (const c of characters) {
    const dna = dnaByCharId[c.id] || dnaByCharId[c.name];
    result += `${c.name}${c.role ? ` (${c.role})` : ''}:\n`;
    if (c.voice_description || c.voice) {
      result += `  Voice: ${c.voice_description || c.voice}\n`;
    }
    if (c.personality || c.notes) {
      result += `  Personality: ${c.personality || c.notes}\n`;
    }
    if (dna?.tone) result += `  Tone: ${dna.tone}\n`;
    if (dna?.formality) result += `  Formality: ${dna.formality}\n`;
    if (dna?.sample_dialogue) result += `  Sample: ${dna.sample_dialogue}\n`;
    result += '\n';
  }
  return result;
}

/**
 * Heuristic dialogue consistency check.
 * @param {string} script
 * @param {Array} characters
 * @param {Record<string, object>} [dnaByCharId]
 */
export function checkVoiceConsistency(script, characters = [], dnaByCharId = {}) {
  const issues = [];
  const lines = String(script || '').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const c of characters) {
      if (!c.name) continue;
      // 仅匹配行首的说话人标记，避免一行含多角色名时误命中
      const hasDialogue = trimmed.startsWith(`${c.name}:`) || trimmed.startsWith(`${c.name}：`);
      if (!hasDialogue) continue;

      const dialogue = extractDialogue(trimmed);
      if (!dialogue) continue;

      const dna = dnaByCharId[c.id] || dnaByCharId[c.name];
      if (!c.voice && !c.voice_description && !dna) continue;

      issues.push(...checkDialogueMatch(dialogue, c, dna));
    }
  }

  return [...new Set(issues)];
}

/**
 * Train voice DNA from character dialogue lines in manuscript.
 * @param {string} script
 * @param {string} characterName
 */
export function trainVoiceDnaFromScript(script, characterName) {
  const lines = String(script || '').split('\n');
  const dialogues = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${characterName}:`) || trimmed.startsWith(`${characterName}：`)) {
      const d = extractDialogue(trimmed);
      if (d) dialogues.push(d);
    }
  }

  if (!dialogues.length) {
    return null;
  }

  const allText = dialogues.join(' ');
  const sentences = allText.split(/[。！？.!?]+/).filter(Boolean);
  const avgSentence = sentences.length
    ? sentences.reduce((s, x) => s + x.length, 0) / sentences.length
    : 0;
  const questions = dialogues.filter((d) => d.includes('?') || d.includes('？')).length;
  const questionRatio = dialogues.length ? questions / dialogues.length : 0;

  const words = {};
  for (const d of dialogues) {
    for (const w of d.split(/\s+|[，,、]/)) {
      if (w.length >= 2) words[w] = (words[w] || 0) + 1;
    }
  }
  const vocabulary = Object.entries(words)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  // 根据语言调整 formality 阈值：中文字符密度高，平均句长远低于英文
  const dialogueText = dialogues.join('');
  const chineseChars = (dialogueText.match(/[一-鿿]/g) || []).length;
  const isChinese = chineseChars / Math.max(dialogueText.length, 1) > 0.3;
  const formalThreshold = isChinese ? 15 : 25;
  const casualThreshold = isChinese ? 7 : 12;

  return {
    avg_sentence: Math.round(avgSentence * 10) / 10,
    question_ratio: Math.round(questionRatio * 100) / 100,
    vocabulary,
    catchphrases: vocabulary.slice(0, 3),
    forbidden_words: [],
    sample_dialogue: dialogues[0]?.slice(0, 200) || '',
    tone: questionRatio > 0.4 ? 'inquisitive' : 'neutral',
    formality: avgSentence > formalThreshold ? 'formal' : avgSentence < casualThreshold ? 'casual' : 'mixed',
  };
}
