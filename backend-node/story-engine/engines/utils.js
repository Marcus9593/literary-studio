export function truncate(s, maxLen) {
  if (!s || s.length <= maxLen) return s || '';
  return `${s.slice(0, maxLen)}...`;
}

export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function minF(a, b) {
  return a < b ? a : b;
}

export function maxI(a, b) {
  return a > b ? a : b;
}

export function minI(a, b) {
  return a < b ? a : b;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Count how many lines contain at least one of the given markers.
 * Each line is counted at most once even if it matches multiple markers.
 * @param {string[]} lines
 * @param {string[]} markers
 * @returns {number}
 */
export function countMarkers(lines, markers) {
  let count = 0;
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const m of markers) {
      if (lower.includes(m.toLowerCase())) {
        count += 1;
        break; // only count each line once
      }
    }
  }
  return count;
}
