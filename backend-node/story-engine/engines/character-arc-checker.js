import { clamp } from './utils.js';

function containsKeywords(content, keywords) {
  const words = String(keywords || '').split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) {
    const short = String(keywords || '').trim();
    return short.length >= 2 && content.includes(short.toLowerCase());
  }
  return words.some((w) => content.includes(w.toLowerCase()));
}

function detectArcProgress(content, charName) {
  const lower = content.toLowerCase();
  const nameLower = charName.toLowerCase();

  const crisisWords = ['crisis', 'breaking point', "can't take", 'never again', '极限', '崩溃', '无法忍受'];
  const resolutionWords = ['finally', 'at last', 'understood', 'accepted', 'embraced', 'let go', '终于', '释然', '接受'];
  const risingWords = ['struggle', 'conflict', 'tension', 'growing', '冲突', '挣扎', '成长'];

  for (const w of crisisWords) {
    if (lower.includes(w) && lower.includes(nameLower)) return 'crisis';
  }
  for (const w of resolutionWords) {
    if (lower.includes(w) && lower.includes(nameLower)) return 'resolution';
  }
  for (const w of risingWords) {
    if (lower.includes(w) && lower.includes(nameLower)) return 'rising';
  }
  return 'setup';
}

function checkCharacter(content, char) {
  const lower = content.toLowerCase();
  const nameLower = String(char.name || '').toLowerCase();

  const arc = {
    name: char.name,
    want_present: false,
    need_present: false,
    ghost_present: false,
    lie_present: false,
    wound_present: false,
    arc_progress: 'setup',
    score: 5,
    issues: [],
  };

  if (!nameLower || !lower.includes(nameLower)) {
    arc.score = 3;
    arc.issues.push('角色未在正文中出现');
    arc.arc_progress = 'missing';
    return arc;
  }

  let score = 5;

  if (char.want) {
    arc.want_present = containsKeywords(lower, char.want);
    if (arc.want_present) score += 1;
    else {
      arc.issues.push('角色的外部目标(Want)在正文中未体现');
      score -= 1;
    }
  }

  if (char.need) {
    arc.need_present = containsKeywords(lower, char.need);
    if (arc.need_present) score += 1;
    else {
      arc.issues.push('角色的内在需求(Need)在正文中未体现');
      score -= 0.5;
    }
  }

  if (char.ghost) {
    arc.ghost_present = containsKeywords(lower, char.ghost);
    if (arc.ghost_present) score += 0.5;
  }

  if (char.lie) {
    arc.lie_present = containsKeywords(lower, char.lie);
    if (arc.lie_present) score += 0.5;
  }

  if (char.wound) {
    arc.wound_present = containsKeywords(lower, char.wound);
    if (arc.wound_present) score += 0.5;
  }

  arc.arc_progress = char.arc_stage || detectArcProgress(content, char.name);
  arc.score = clamp(score, 0, 10);
  return arc;
}

/**
 * @param {string} content
 * @param {Array} characters — KB character items with psych fields
 */
export function checkCharacterArc(content, characters = []) {
  if (!characters.length) {
    return {
      score: 5,
      level: 'SOFT',
      character_arcs: [],
      summary: '未定义角色档案，无法检查角色弧线',
    };
  }

  const arcs = characters.map((c) => checkCharacter(content, c));
  const avgScore = arcs.reduce((s, a) => s + a.score, 0) / arcs.length;

  let level = 'PASS';
  if (avgScore < 4) level = 'HARD';
  else if (avgScore < 7) level = 'SOFT';

  const issues = [];
  for (const arc of arcs) {
    for (const issue of arc.issues) {
      issues.push(`${arc.name}: ${issue}`);
    }
  }

  return {
    score: Math.round(avgScore * 10) / 10,
    level,
    character_arcs: arcs,
    summary: issues.length ? issues.join('; ') : '角色弧线推进良好',
  };
}
