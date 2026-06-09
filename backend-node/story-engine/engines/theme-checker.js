const THEME_KEYWORDS = {
  正义: ['justice', 'right', 'wrong', 'fair', 'moral', '正义', '公正'],
  爱情: ['love', 'heart', 'passion', 'romance', '爱情', '恋人', '心动'],
  背叛: ['betray', 'trust', 'lie', 'deceive', '背叛', '欺骗', '谎言'],
  救赎: ['redeem', 'forgive', 'atone', 'salvation', '救赎', '原谅', '赎罪'],
  成长: ['grow', 'learn', 'change', 'evolve', 'mature', '成长', '改变', '蜕变'],
  权力: ['power', 'control', 'authority', 'dominate', '权力', '控制', '支配'],
  自由: ['freedom', 'liberate', 'escape', 'free', '自由', '解放', '逃脱'],
  死亡: ['death', 'die', 'mortal', 'end', '死亡', '终结', '消逝'],
  身份认同: ['identity', 'who am i', 'belong', 'self', '身份', '我是谁', '归属'],
  复仇: ['revenge', 'vengeance', 'avenge', 'payback', '复仇', '报复', '报仇'],
  牺牲: ['sacrifice', 'give up', 'surrender', 'noble', '牺牲', '奉献', '放弃'],
  真相: ['truth', 'reveal', 'discover', 'secret', '真相', '发现', '秘密'],
};

function parseThemes(bibleThemes) {
  if (!bibleThemes) return [];
  if (Array.isArray(bibleThemes)) return bibleThemes.filter(Boolean);
  return String(bibleThemes)
    .split(/[,，、\n]/)
    .map((t) => t.trim().replace(/^["'\[]|["'\]]$/g, ''))
    .filter(Boolean);
}

function detectThemes(content) {
  const lower = content.toLowerCase();
  const detected = [];

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    let strength = 0;
    const matched = [];
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        strength += 1.5;
        matched.push(kw);
      }
    }
    if (strength > 0) {
      detected.push({
        theme,
        strength: Math.min(10, strength),
        keywords: matched,
      });
    }
  }
  return detected;
}

function calcDrift(bibleThemes, detected) {
  if (!bibleThemes.length) return 0;

  let matched = 0;
  for (const bt of bibleThemes) {
    const btLower = bt.toLowerCase();
    for (const d of detected) {
      if (d.theme.toLowerCase().includes(btLower) || btLower.includes(d.theme.toLowerCase())) {
        matched += 1;
        break;
      }
    }
  }
  return ((bibleThemes.length - matched) / bibleThemes.length) * 10;
}

function buildSummary(bibleThemes, detected, drift) {
  if (!bibleThemes.length) {
    if (detected.length) {
      return `检测到主题：${detected.map((d) => d.theme).join('、')}（设定未定义主题，无法对比）`;
    }
    return '未检测到明显主题表达';
  }
  if (drift < 2) return '主题表达与设定高度一致';
  if (drift < 5) return '主题表达基本一致，部分主题未充分体现';
  return '主题表达与设定有较大偏差，需要加强';
}

/**
 * @param {string} content
 * @param {string|string[]} bibleThemes
 */
export function checkTheme(content, bibleThemes = '') {
  const lower = String(content || '').toLowerCase();
  const themes = parseThemes(bibleThemes);
  const detected = detectThemes(lower);
  const drift = calcDrift(themes, detected);
  const score = Math.max(0, 10 - drift);

  let level = 'PASS';
  if (score < 4) level = 'HARD';
  else if (score < 7) level = 'SOFT';

  return {
    score: Math.round(score * 10) / 10,
    level,
    detected_themes: detected,
    bible_themes: themes,
    drift: Math.round(drift * 10) / 10,
    summary: buildSummary(themes, detected, drift),
  };
}
