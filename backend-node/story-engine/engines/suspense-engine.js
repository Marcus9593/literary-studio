import { countMarkers, maxI, minF, minI, round1, truncate } from './utils.js';

const INTENSITY_MARKERS = [
  'tension', 'urgency', 'deadline', 'countdown', 'secret', 'reveal', 'betrayal',
  'confrontation', 'danger', 'threat', 'escape', 'chase', 'fear', 'panic', 'scream',
  'gun', 'knife', 'blood', 'death', 'kill',
  '紧张', '紧迫', '截止', '倒计时', '秘密', '揭示', '背叛', '对峙', '危险', '威胁',
  '恐惧', '尖叫', '枪', '刀', '血', '死亡', '杀',
];

const CLIFF_MARKERS = [
  '?', '!', 'suddenly', 'but then', 'revealed', 'the door', 'turned to find',
  'was gone', 'everything went dark', 'the phone rang', 'a knock at the door', 'it was him',
  '突然', '然而', '门', '消失了', '一片黑暗', '电话响起', '敲门', '是他',
];

const OPEN_MARKERS = [
  'mystery', 'unknown', 'unanswered', 'secret', 'hidden', 'dark past', 'missing', 'lost', 'forgotten', 'buried',
  '谜团', '未知', '未解', '秘密', '隐藏', '黑暗过去', '失踪', '失落', '遗忘', '埋藏',
];

const RESOLVE_MARKERS = [
  'revealed', 'explained', 'finally understood', 'the truth was', 'discovered that',
  'found out', 'solved', 'answered', 'closure', 'resolved',
  '揭示', '解释', '终于明白', '真相', '发现', '解开', '回答', '了结', '解决',
];

function classifyLevel(intensity) {
  if (intensity >= 8) return 'critical';
  if (intensity >= 6) return 'high';
  if (intensity >= 4) return 'medium';
  return 'low';
}

function calcLineIntensity(line) {
  const markers = ['tension', 'urgency', 'deadline', 'secret', 'reveal', 'betrayal', 'danger', 'threat', 'fear', 'panic', 'scream', 'death',
    '紧张', '紧迫', '秘密', '揭示', '背叛', '危险', '恐惧', '尖叫', '死亡'];
  let count = 0;
  const lower = line.toLowerCase();
  for (const m of markers) {
    if (lower.includes(m)) count += 1;
  }
  return minF(10, count * 1.5 + 3);
}

function findLinesWithMarkers(lines, markers, limit = 8) {
  const out = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const m of markers) {
      if (lower.includes(m.toLowerCase())) {
        out.push(line.trim());
        break;
      }
    }
    if (out.length >= limit) break;
  }
  return out;
}

function buildThreads(lines, episode) {
  const categories = [
    { markers: ['mystery', 'unknown', 'secret', 'hidden', 'who', 'why', 'how', '谜团', '未知', '秘密', '谁', '为何', '如何'], catName: 'mystery' },
    { markers: ['danger', 'threat', 'chase', 'escape', 'gun', 'knife', 'kill', 'death', '危险', '威胁', '追逐', '逃跑', '枪', '死亡'], catName: 'danger' },
    { markers: ['love', 'betray', 'trust', 'lie', 'cheat', 'affair', 'jealous', '爱', '背叛', '信任', '谎言', '嫉妒'], catName: 'relationship' },
    { markers: ['reveal', 'discover', 'truth', 'confess', 'admit', 'expose', '揭示', '发现', '真相', '坦白', '承认', '曝光'], catName: 'revelation' },
  ];

  const seen = new Set();
  const threads = [];

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (lower.length < 10) continue;
    const key = lower.slice(0, minI(30, lower.length));
    if (seen.has(key)) continue;

    for (const cat of categories) {
      let hit = false;
      for (const m of cat.markers) {
        if (lower.includes(m.toLowerCase())) {
          hit = true;
          break;
        }
      }
      if (!hit) continue;

      seen.add(key);
      const intensity = calcLineIntensity(lower);
      threads.push({
        name: truncate(line.trim(), 50),
        intensity: round1(intensity),
        status: intensity > 7 ? 'peak' : 'active',
        episode,
        category: cat.catName,
      });
      break;
    }
    if (threads.length >= 10) break;
  }

  return threads;
}

function calcTensionCurve(lines) {
  const segCount = minI(10, lines.length);
  if (segCount === 0) return [];

  const segSize = Math.max(1, Math.floor(lines.length / segCount));
  const curve = [];
  const markers = INTENSITY_MARKERS;

  for (let i = 0; i < segCount; i += 1) {
    const start = i * segSize;
    const end = i === segCount - 1 ? lines.length : start + segSize;
    const count = countMarkers(lines.slice(start, end), markers);
    curve.push(minF(100, count * 10 + 10));
  }
  return curve;
}

function findPeakMoment(lines) {
  let peakLine = '';
  let peakScore = 0;
  const markers = INTENSITY_MARKERS;

  for (const line of lines) {
    const lower = line.toLowerCase();
    let score = 0;
    for (const m of markers) {
      if (lower.includes(m.toLowerCase())) score += 1;
    }
    if (score > peakScore) {
      peakScore = score;
      peakLine = line.trim();
    }
  }
  return truncate(peakLine, 100);
}

/**
 * @param {string} content
 * @param {number} [episode=1]
 */
export function analyzeSuspense(content, episode = 1) {
  const lines = String(content || '').split('\n');
  const count = countMarkers(lines, INTENSITY_MARKERS);
  const intensity = count === 0 ? 2.0 : minF(10, count * 0.5);

  const cliffStart = maxI(0, lines.length - maxI(1, Math.floor(lines.length / 10)));
  const endLines = lines.slice(cliffStart);
  let cliffhanger = false;
  for (const line of endLines) {
    const lower = line.toLowerCase();
    for (const m of CLIFF_MARKERS) {
      if (lower.includes(m.toLowerCase())) {
        cliffhanger = true;
        break;
      }
    }
    if (cliffhanger) break;
  }

  return {
    intensity,
    level: classifyLevel(intensity),
    cliffhanger,
    open_threads: findLinesWithMarkers(lines, OPEN_MARKERS),
    resolved: findLinesWithMarkers(lines, RESOLVE_MARKERS),
    threads: buildThreads(lines, episode),
    peak_moment: findPeakMoment(lines),
    tension_curve: calcTensionCurve(lines),
  };
}
