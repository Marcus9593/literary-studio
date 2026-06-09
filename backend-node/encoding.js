import iconv from 'iconv-lite';

/**
 * Detect encoding of a buffer and decode it to a UTF-8 string.
 * Handles UTF-8 BOM, UTF-16 LE/BE BOM, and falls back to GB18030/GBK.
 */
export function decodeBuffer(buf) {
  if (!buf || buf.length === 0) return '';

  // BOM detection
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    // UTF-8 BOM
    return buf.subarray(3).toString('utf-8');
  }
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    // UTF-16 LE BOM
    return iconv.decode(buf.subarray(2), 'utf-16le');
  }
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    // UTF-16 BE BOM
    return iconv.decode(buf.subarray(2), 'utf-16be');
  }

  // Try UTF-8 first — if it decodes without errors, use it
  const utf8Str = buf.toString('utf-8');
  if (!utf8Str.includes('�')) {
    return utf8Str;
  }

  // Try GB18030 (superset of GBK)
  try {
    const gbStr = iconv.decode(buf, 'gb18030');
    // Verify it produced real CJK characters, not just garbage
    if (/[一-鿿]/.test(gbStr)) {
      return gbStr;
    }
  } catch {}

  // Try GBK
  try {
    const gbkStr = iconv.decode(buf, 'gbk');
    if (/[一-鿿]/.test(gbkStr)) {
      return gbkStr;
    }
  } catch {}

  // Last resort: UTF-8 with replacement characters
  return utf8Str;
}

/**
 * Check if a file extension is a text type that needs encoding conversion.
 */
export function isTextFile(ext) {
  return ['.md', '.markdown', '.txt', '.html', '.htm', '.csv', '.json', '.xml'].includes(ext);
}

/**
 * Multer/busboy often decodes UTF-8 filenames as latin1 (e.g. 第01集 → ç¬¬01é).
 */
export function decodeUploadFilename(name) {
  if (!name || typeof name !== 'string') return name || '';
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    const origCjk = /[\u4e00-\u9fff]/.test(name);
    const fixedCjk = /[\u4e00-\u9fff]/.test(fixed);
    if (!origCjk && fixedCjk && !fixed.includes('\uFFFD')) return fixed;
    if (name.includes('\uFFFD') && fixedCjk) return fixed;
  } catch {
    /* keep original */
  }
  return name;
}

/** Heuristic: UTF-8 CJK misread as latin1 (e.g. ç¬¬01é). */
export function looksLikeMojibake(name) {
  if (!name || /[\u4e00-\u9fff]/.test(name)) return false;
  return /[ÃÂçéêëìíîïðñòóôõö÷øùúûüýþÿ]/.test(name)
    || (/[^\x00-\x7f]/.test(name) && /[a-zA-Z]{2,}/.test(name));
}
