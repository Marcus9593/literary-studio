/** 人物名推断质量过滤 */

const SKIP_NAMES = new Set([
  '什么', '怎么', '为什么', '可以', '不是', '这个', '那个', '自己', '他们', '我们', '你们',
  '大家', '这时', '此时', '一声', '一句', '只见', '突然', '然后', '不过', '因为', '所以',
  '如果', '已经', '没有', '知道', '觉得', '看着', '淡淡', '冷冷', '轻轻', '默默', '我知',
  '一个', '一位', '一种', '一些',
]);

const JUNK_SUFFIXES = ['没', '的', '了', '着', '过', '吗', '呢', '吧', '啊'];
const JUNK_PREFIXES = ['个', '一', '这', '那', '某', '位', '名'];

export function isPlausibleCharacterName(name) {
  const n = String(name || '').trim();
  if (n.length < 2 || n.length > 8) return false;
  if (!/^[\u4e00-\u9fa5]+$/.test(n)) return false;
  if (SKIP_NAMES.has(n)) return false;
  if (/^个/.test(n)) return false;
  if (JUNK_SUFFIXES.some((s) => n.endsWith(s) && n.length <= 4)) return false;
  if (/[说道问答喊叫笑怒叹回提想]$/.test(n)) return false;
  if (/^(巨大|巨大|东西|事情|时候|地方|感觉|声音|目光|眼神)/.test(n)) return false;
  return true;
}

export function filterInferredCharacterItems(items) {
  return (items || []).filter((c) => {
    if (c.source !== 'inferred') return true;
    return isPlausibleCharacterName(c.name || c.id);
  });
}
