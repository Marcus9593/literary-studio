import {
  reviewStructure,
  reviewCharacter,
  reviewScene,
  reviewDialogue,
  reviewTheme,
  reviewNovelStyle,
} from './reviewers.js';

const TYPE_TO_DIMENSION = {
  STRUCTURE: 'structure',
  CHARACTER: 'character',
  SCENE: 'scene',
  DIALOGUE: 'voice',
  THEME: 'continuity',
  VOICE: 'voice',
  PRESSURE: 'pressure',
};

function buildRevisionTasks(hardIssues, softIssues) {
  const tasks = [];
  let priority = 1;
  for (const issue of [...hardIssues, ...softIssues]) {
    tasks.push({
      priority,
      target: issue.scene,
      action: issue.fix,
      reason: `[${issue.rule}] ${issue.problem}`,
    });
    priority += 1;
  }
  return tasks;
}

function determineVerdict(hardIssues, softIssues) {
  if (hardIssues.length >= 3) return 'REJECT';
  if (hardIssues.length > 0) return 'REVISE';
  if (softIssues.length > 2) return 'REVISE';
  return 'APPROVE';
}

function buildSummary(hardIssues, softIssues, strengths) {
  const lines = [
    `发现 ${hardIssues.length} 个严重问题，${softIssues.length} 个轻微问题，${strengths.length} 个优点。`,
    '',
  ];
  if (hardIssues.length) {
    lines.push('严重问题：');
    for (const i of hardIssues) lines.push(`- [${i.rule}] ${i.problem}`);
    lines.push('');
  }
  if (softIssues.length) {
    lines.push('轻微问题：');
    for (const i of softIssues) lines.push(`- [${i.rule}] ${i.problem}`);
    lines.push('');
  }
  if (strengths.length) {
    lines.push('优点：');
    for (const s of strengths) lines.push(`- ${s.detail}`);
  }
  return lines.join('\n').trim();
}

function dimensionFromIssues(issues, label) {
  const related = issues.filter((i) => TYPE_TO_DIMENSION[i.type] === label);
  const hard = related.filter((i) => i.severity === 'HARD');
  const soft = related.filter((i) => i.severity === 'SOFT');
  let level = 'PASS';
  if (hard.length) level = 'HARD';
  else if (soft.length) level = 'SOFT';
  const score = level === 'HARD' ? 4 : level === 'SOFT' ? 6 : 8;
  const details = related.length
    ? related.map((i) => i.problem).join('；')
    : `${label} 维度未发现明显问题`;
  return { score, level, details };
}

/**
 * @param {string} content
 * @param {{ characterNames?: string[], bibleThemes?: string, workType?: string }} options
 */
export function runCriticReview(content, options = {}) {
  const text = String(content || '');
  const characterNames = options.characterNames || [];
  const bibleThemes = options.bibleThemes || '';
  const workType = options.workType || 'novel_long';
  const isScreenplay = workType.startsWith('screenplay') || workType === 'web_short';

  const structureReport = reviewStructure(text);
  const characterReport = reviewCharacter(text, characterNames);
  const sceneReport = reviewScene(text);
  const dialogueReport = reviewDialogue(text);
  const themeReport = reviewTheme(text, bibleThemes);
  const novelExtra = isScreenplay ? { issues: [], strengths: [] } : reviewNovelStyle(text);

  const allIssues = [
    ...structureReport.issues,
    ...characterReport.issues,
    ...sceneReport.issues,
    ...dialogueReport.issues,
    ...themeReport.issues,
    ...novelExtra.issues,
  ];
  const hardIssues = allIssues.filter((i) => i.severity === 'HARD');
  const softIssues = allIssues.filter((i) => i.severity === 'SOFT');
  const strengths = [
    ...structureReport.strengths,
    ...characterReport.strengths,
    ...sceneReport.strengths,
    ...dialogueReport.strengths,
    ...themeReport.strengths,
    ...novelExtra.strengths,
  ];

  const professional = {
    hard_issues: hardIssues,
    soft_issues: softIssues,
    strengths,
    revision_tasks: buildRevisionTasks(hardIssues, softIssues),
    overall_verdict: determineVerdict(hardIssues, softIssues),
    summary: buildSummary(hardIssues, softIssues, strengths),
  };

  const critic_report = {
    structure: dimensionFromIssues(allIssues, 'structure'),
    character: dimensionFromIssues(allIssues, 'character'),
    scene: dimensionFromIssues(allIssues, 'scene'),
    pressure: dimensionFromIssues(allIssues, 'pressure'),
    voice: dimensionFromIssues(allIssues, 'voice'),
    continuity: dimensionFromIssues(allIssues, 'continuity'),
    overall: professional.overall_verdict === 'APPROVE' ? 'PASS'
      : professional.overall_verdict === 'REJECT' ? 'HARD' : 'SOFT',
    summary: professional.summary,
  };

  if (text.length < 500) {
    critic_report.structure = { score: 4, level: 'SOFT', details: '文稿过短，结构分析参考价值有限。' };
  }

  return {
    scoring_method: 'rules',
    work_type: workType,
    professional_review: professional,
    critic_report,
    sub_reports: {
      structure: structureReport,
      character: characterReport,
      scene: sceneReport,
      dialogue: dialogueReport,
      theme: themeReport,
    },
  };
}
