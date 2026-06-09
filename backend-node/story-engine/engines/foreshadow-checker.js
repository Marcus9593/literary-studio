import { truncate } from './utils.js';

const SETUP_MARKERS = [
  { keyword: 'omen', element: '预兆' },
  { keyword: 'prophecy', element: '预言' },
  { keyword: 'warning', element: '警告' },
  { keyword: 'foreboding', element: '不祥预感' },
  { keyword: 'sign', element: '征兆' },
  { keyword: 'hint', element: '暗示' },
  { keyword: 'clue', element: '线索' },
  { keyword: 'symbol', element: '象征' },
  { keyword: 'dream', element: '梦境' },
  { keyword: 'vision', element: '幻象' },
  { keyword: 'rumor', element: '传言' },
  { keyword: 'legend', element: '传说' },
  { keyword: 'myth', element: '神话' },
  { keyword: 'curse', element: '诅咒' },
  { keyword: 'promise', element: '承诺' },
  { keyword: 'threat', element: '威胁' },
  { keyword: '伏笔', element: '伏笔' },
  { keyword: '暗示', element: '暗示' },
  { keyword: '预兆', element: '预兆' },
  { keyword: '预言', element: '预言' },
  { keyword: '线索', element: '线索' },
];

const PAYOFF_MARKERS = [
  { keyword: 'came true', element: '应验' },
  { keyword: 'fulfilled', element: '实现' },
  { keyword: 'happened', element: '发生' },
  { keyword: 'realized', element: '意识到' },
  { keyword: 'remembered', element: '想起' },
  { keyword: 'understood', element: '理解' },
  { keyword: 'prophecy fulfilled', element: '预言实现' },
  { keyword: 'omen came', element: '预兆应验' },
  { keyword: '应验', element: '应验' },
  { keyword: '实现', element: '实现' },
  { keyword: '想起', element: '想起' },
  { keyword: '回收', element: '回收' },
  { keyword: '兑现', element: '兑现' },
];

function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.element}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSummary(items, setups, payoffs) {
  if (!items.length) return '未检测到明显的伏笔元素';
  const parts = [];
  if (setups > 0) parts.push(`埋设了${setups}个伏笔`);
  if (payoffs > 0) parts.push(`回收了${payoffs}个伏笔`);
  const unresolved = setups - payoffs;
  if (unresolved > 0) parts.push(`还有${unresolved}个伏笔待回收`);
  return parts.join('，');
}

/**
 * @param {string} content
 * @param {number} [episode=1]
 */
export function checkForeshadow(content, episode = 1) {
  const lines = String(content || '').split('\n');
  const items = [];

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (lower.length < 5) continue;

    for (const marker of SETUP_MARKERS) {
      if (lower.includes(marker.keyword)) {
        items.push({
          element: marker.element,
          type: 'setup',
          line: truncate(line.trim(), 80),
          resolved: false,
          episode,
        });
        break;
      }
    }

    for (const marker of PAYOFF_MARKERS) {
      if (lower.includes(marker.keyword)) {
        items.push({
          element: marker.element,
          type: 'payoff',
          line: truncate(line.trim(), 80),
          resolved: true,
          episode,
        });
        break;
      }
    }
  }

  const deduped = deduplicate(items);
  let setups = 0;
  let payoffs = 0;
  for (const item of deduped) {
    if (item.type === 'setup') setups += 1;
    else if (item.type === 'payoff') payoffs += 1;
  }

  let score = 5;
  if (setups > 0 && payoffs > 0) score = 8;
  else if (setups > 0) score = 6;
  else if (payoffs > 0) score = 7;

  let level = 'PASS';
  if (score < 4) level = 'HARD';
  else if (score < 7) level = 'SOFT';

  return {
    score,
    level,
    foreshadows: deduped,
    summary: buildSummary(deduped, setups, payoffs),
  };
}
