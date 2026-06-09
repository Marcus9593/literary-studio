import {
  STRUCTURE_KEYWORDS,
  CHARACTER_KEYWORDS,
  SCENE_CONFLICT_KEYWORDS,
  SCENE_CHANGE_KEYWORDS,
  SCENE_INFO_KEYWORDS,
  EXPOSITION_KEYWORDS,
  SUBTEXT_INDICATORS,
  THEME_KEYWORDS,
  AI_PHRASES,
} from './keywords.js';

function detectElement(content, keywords) {
  const lower = content.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function isSceneHeader(line) {
  const upper = line.trim().toUpperCase();
  return upper.startsWith('## ')
    || upper.startsWith('INT.')
    || upper.startsWith('EXT.')
    || /^第[一二三四五六七八九十百\d]+[章节场]/.test(line.trim());
}

export function reviewStructure(content) {
  const lines = content.split('\n');
  const lower = content.toLowerCase();
  let sceneCount = 0;
  for (const line of lines) {
    if (isSceneHeader(line)) sceneCount += 1;
  }

  const report = {
    has_three_acts: sceneCount >= 3,
    has_midpoint: detectElement(lower, STRUCTURE_KEYWORDS.midpoint),
    has_climax: detectElement(lower, STRUCTURE_KEYWORDS.climax),
    has_inciting_incident: detectElement(lower, STRUCTURE_KEYWORDS.inciting_incident),
    issues: [],
    strengths: [],
  };

  if (!report.has_inciting_incident) {
    report.issues.push({
      type: 'STRUCTURE',
      scene: 'overall',
      severity: 'HARD',
      rule: 'Inciting Incident',
      problem: '未检测到激励事件。开篇缺少打破常态的关键事件。',
      fix: '在开端添加改变主角处境的关键事件。',
    });
  }
  if (!report.has_midpoint) {
    report.issues.push({
      type: 'STRUCTURE',
      scene: 'overall',
      severity: 'HARD',
      rule: 'Midpoint',
      problem: '未检测到中点转折。缺少不可逆的局势变化。',
      fix: '在中段添加改变目标或处境的不可逆事件。',
    });
  }
  if (!report.has_climax) {
    report.issues.push({
      type: 'STRUCTURE',
      scene: 'overall',
      severity: 'SOFT',
      rule: 'Climax',
      problem: '未检测到明确的高潮时刻。',
      fix: '确保有主角面临最大挑战的高潮场景。',
    });
  }
  if (report.has_three_acts) {
    report.strengths.push({
      type: 'STRUCTURE',
      scene: 'overall',
      detail: '结构分段清晰，具备多场景/多章节节奏。',
    });
  }
  return report;
}

export function reviewCharacter(content, characterNames = []) {
  const lower = content.toLowerCase();
  const report = { characters: [], issues: [], strengths: [] };

  for (const name of characterNames) {
    const nameLower = name.toLowerCase();
    if (!lower.includes(nameLower)) continue;

    const analysis = {
      name,
      has_want: detectElement(lower, CHARACTER_KEYWORDS.want),
      has_need: detectElement(lower, CHARACTER_KEYWORDS.need),
      has_ghost: detectElement(lower, CHARACTER_KEYWORDS.ghost),
      arc_stage: detectElement(lower, CHARACTER_KEYWORDS.arc_change) ? 'resolution' : 'setup',
    };
    report.characters.push(analysis);

    if (!analysis.has_want) {
      report.issues.push({
        type: 'CHARACTER',
        scene: 'overall',
        severity: 'HARD',
        rule: 'Want',
        problem: `${name} 的外在目标（Want）体现不足。`,
        fix: `为 ${name} 添加明确的外在目标。`,
      });
    }
    if (!analysis.has_need) {
      report.issues.push({
        type: 'CHARACTER',
        scene: 'overall',
        severity: 'SOFT',
        rule: 'Need',
        problem: `${name} 的内在需求（Need）体现不足。`,
        fix: `为 ${name} 补充内在成长需求。`,
      });
    }
    if (analysis.has_want && analysis.has_need) {
      report.strengths.push({
        type: 'CHARACTER',
        scene: 'overall',
        detail: `${name} 的 Want 与 Need 均有体现。`,
      });
    }
  }
  return report;
}

export function reviewScene(content) {
  const lines = content.split('\n');
  const report = { total_scenes: 0, waste_scenes: [], strong_scenes: [], issues: [], strengths: [] };

  let currentScene = '';
  let sceneContent = '';

  const flush = () => {
    if (!currentScene) return;
    const lower = sceneContent.toLowerCase();
    const hasConflict = SCENE_CONFLICT_KEYWORDS.some((kw) => lower.includes(kw));
    const hasChange = SCENE_CHANGE_KEYWORDS.some((kw) => lower.includes(kw));
    const hasInfo = SCENE_INFO_KEYWORDS.some((kw) => lower.includes(kw));

    if (!hasConflict && !hasChange) {
      report.waste_scenes.push(currentScene);
      report.issues.push({
        type: 'SCENE',
        scene: currentScene,
        severity: 'SOFT',
        rule: 'Scene Waste',
        problem: '场景/段落缺少冲突和转折，可能无效。',
        fix: '添加冲突、转折或考虑删减。',
      });
    } else if (hasConflict && hasChange && hasInfo) {
      report.strong_scenes.push(currentScene);
      report.strengths.push({
        type: 'SCENE',
        scene: currentScene,
        detail: '场景有冲突、转折与信息增量。',
      });
    }
  };

  for (const line of lines) {
    if (isSceneHeader(line)) {
      flush();
      currentScene = line.trim();
      sceneContent = '';
      report.total_scenes += 1;
    } else {
      sceneContent += `${line}\n`;
    }
  }
  flush();

  if (report.total_scenes === 0 && content.trim().length > 200) {
    report.total_scenes = 1;
    report.issues.push({
      type: 'SCENE',
      scene: 'overall',
      severity: 'SOFT',
      rule: 'Scene Markers',
      problem: '未检测到明确场景/章节分段标记。',
      fix: '使用 ## 场景标题或章节标题分段。',
    });
  }
  return report;
}

export function reviewDialogue(content) {
  const lower = content.toLowerCase();
  const hasExposition = EXPOSITION_KEYWORDS.some((kw) => lower.includes(kw));
  const hasSubtext = SUBTEXT_INDICATORS.some((kw) => lower.includes(kw));
  const report = { has_exposition: hasExposition, has_subtext: hasSubtext, issues: [], strengths: [] };

  if (hasExposition) {
    report.issues.push({
      type: 'DIALOGUE',
      scene: 'overall',
      severity: 'SOFT',
      rule: 'No Exposition Dump',
      problem: '可能存在信息倾倒式对白。',
      fix: '通过行动和情境展现背景，而非角色解释。',
    });
  }
  if (!hasSubtext) {
    report.issues.push({
      type: 'DIALOGUE',
      scene: 'overall',
      severity: 'SOFT',
      rule: 'Subtext Over Text',
      problem: '对白偏直白，潜台词不足。',
      fix: '让角色意图隐藏在对白之下。',
    });
  } else {
    report.strengths.push({
      type: 'DIALOGUE',
      scene: 'overall',
      detail: '对白中存在潜台词痕迹。',
    });
  }
  return report;
}

export function reviewTheme(content, bibleThemes = '') {
  const lower = content.toLowerCase();
  const detected = [];
  for (const [key, label] of Object.entries(THEME_KEYWORDS)) {
    if (lower.includes(key) || lower.includes(label)) detected.push(label);
  }

  const themeLower = bibleThemes.toLowerCase();
  let reinforcement = 0;
  if (themeLower) {
    for (const word of themeLower.split(/[\s,，、]+/).filter(Boolean)) {
      if (lower.includes(word.toLowerCase())) reinforcement += 1;
    }
  }
  reinforcement += detected.length;

  const half = Math.floor(content.length / 2);
  const themeDrift = themeLower
    ? !content.slice(0, half).toLowerCase().includes(themeLower.slice(0, 8))
      && content.slice(half).toLowerCase().includes(themeLower.slice(0, 8))
    : false;

  const report = {
    detected_themes: detected,
    theme_drift: themeDrift,
    reinforcement_count: reinforcement,
    issues: [],
    strengths: [],
  };

  if (themeDrift) {
    report.issues.push({
      type: 'THEME',
      scene: 'overall',
      severity: 'HARD',
      rule: 'Theme Drift',
      problem: '后半部分可能偏离前半部分建立的主题。',
      fix: '统一主题表达，或明确主题转变理由。',
    });
  }
  if (reinforcement < 2) {
    report.issues.push({
      type: 'THEME',
      scene: 'overall',
      severity: 'SOFT',
      rule: 'Theme Reinforcement',
      problem: '主题强化不足。',
      fix: '增加 2-3 处与核心主题相关的场景或描写。',
    });
  }
  if (reinforcement >= 3) {
    report.strengths.push({
      type: 'THEME',
      scene: 'overall',
      detail: '主题在多处得到强化。',
    });
  }
  return report;
}

export function reviewNovelStyle(content) {
  const issues = [];
  const strengths = [];
  const aiHits = AI_PHRASES.filter((p) => content.includes(p)).length;
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
  const avgPara = paragraphs.length ? Math.round(content.replace(/\s/g, '').length / paragraphs.length) : 0;

  if (aiHits >= 3) {
    issues.push({
      type: 'VOICE',
      scene: 'overall',
      severity: 'SOFT',
      rule: 'AI Phrases',
      problem: `检测到 ${aiHits} 处常见 AI 套话。`,
      fix: '逐段润色，替换套路化表达。',
    });
  }
  if (avgPara > 280) {
    issues.push({
      type: 'PRESSURE',
      scene: 'overall',
      severity: 'SOFT',
      rule: 'Pacing',
      problem: '段落偏长，节奏可能偏慢。',
      fix: '拆段或增加对话/动作切换。',
    });
  }
  if (aiHits === 0 && avgPara > 0 && avgPara < 200) {
    strengths.push({
      type: 'VOICE',
      scene: 'overall',
      detail: '文风较自然，段落节奏适中。',
    });
  }
  return { issues, strengths };
}
