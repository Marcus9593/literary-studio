import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { loadKnowledgeBundle } from '../story-kb/store.js';
import { listChapters, resolveManuscriptPath, getProject } from '../storage.js';
import { decodeBuffer } from '../lib/encoding.js';

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mdToXhtml(md) {
  const blocks = String(md || '').split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const t = block.trim();
      if (!t) return '';
      if (/^#{1,6}\s/.test(t)) {
        const m = /^(#{1,6})\s+(.+)$/.exec(t.split('\n')[0]);
        const level = Math.min(6, m[1].length);
        return `<h${level}>${escapeXml(m[2])}</h${level}>`;
      }
      const lines = t.split('\n').map((l) => escapeXml(l)).join('<br/>');
      return `<p>${lines}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * 生成 EPUB 3（纯 Node，无 pandoc）
 * @param {{ projectId: string, outputPath: string }} opts
 */
export async function createProjectEpub({ projectId, outputPath }) {
  const meta = getProject(projectId);
  const title = meta.title || '未命名作品';
  const author = meta.author || '文匠作者';
  const chapters = listChapters(projectId);
  if (!chapters.length) throw new Error('项目尚无正文章节，无法导出 EPUB');

  const chapterDocs = chapters.map((ch, i) => {
    const fp = resolveManuscriptPath(projectId, ch.filename);
    const content = decodeBuffer(fs.readFileSync(fp));
    const id = `ch${String(i + 1).padStart(3, '0')}`;
    const chTitle = ch.title || ch.filename.replace(/\.md$/i, '');
    return { id, title: chTitle, html: mdToXhtml(content) };
  });

  const uuid = `urn:uuid:wenjiang-${projectId}-${Date.now()}`;
  const manifestItems = chapterDocs
    .map((c) => `<item id="${c.id}" href="${c.id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n    ');
  const spineItems = chapterDocs.map((c) => `<itemref idref="${c.id}"/>`).join('\n    ');
  const navLi = chapterDocs
    .map((c) => `<li><a href="${c.id}.xhtml">${escapeXml(c.title)}</a></li>`)
    .join('\n        ');

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="BookId">${uuid}</dc:identifier>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`;

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
  <nav epub:type="toc"><ol>${navLi}</ol></nav>
</body>
</html>`;

  const tmpDir = fs.mkdtempSync(path.join(path.dirname(outputPath), '.epub-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'mimetype'), 'application/epub+zip');
    fs.mkdirSync(path.join(tmpDir, 'META-INF'));
    fs.writeFileSync(
      path.join(tmpDir, 'META-INF', 'container.xml'),
      `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    );
    fs.mkdirSync(path.join(tmpDir, 'OEBPS'));
    fs.writeFileSync(path.join(tmpDir, 'OEBPS', 'content.opf'), contentOpf);
    fs.writeFileSync(path.join(tmpDir, 'OEBPS', 'nav.xhtml'), navXhtml);
    for (const ch of chapterDocs) {
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(ch.title)}</title></head>
<body>${ch.html}</body>
</html>`;
      fs.writeFileSync(path.join(tmpDir, 'OEBPS', `${ch.id}.xhtml`), body);
    }

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      out.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(out);
      archive.file(path.join(tmpDir, 'mimetype'), { name: 'mimetype', store: true });
      archive.directory(path.join(tmpDir, 'META-INF'), 'META-INF');
      archive.directory(path.join(tmpDir, 'OEBPS'), 'OEBPS');
      archive.finalize();
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  return outputPath;
}

/**
 * 设定一致性：名称表与正文交叉核对
 * @param {string} projectId
 * @param {{ scanChapterCount?: number }} [opts] scanChapterCount 扫描最近 N 章，默认 0 表示全部
 */
export function checkSettingsConsistency(projectId, opts = {}) {
  const kb = loadKnowledgeBundle(projectId);
  const characters = (kb.characters?.items || []).map((c) => ({
    name: c.name,
    aliases: c.aliases || c.alias || [],
    id: c.id,
  })).filter((c) => c.name);
  const locations = (kb.locations?.items || []).map((l) => l.name).filter(Boolean);
  const chapters = listChapters(projectId);
  const scanChapterCount = opts.scanChapterCount || 0;
  const chaptersToScan = scanChapterCount > 0 ? chapters.slice(-scanChapterCount) : chapters;
  let fullText = '';
  for (const ch of chaptersToScan) {
    try {
      fullText += decodeBuffer(fs.readFileSync(resolveManuscriptPath(projectId, ch.filename)));
    } catch {}
  }

  const issues = [];
  const nameCounts = {};

  // 重名检测
  const nameMap = new Map();
  for (const c of characters) {
    const key = c.name.trim();
    if (nameMap.has(key)) {
      issues.push({
        kind: 'duplicate_name',
        name: key,
        message: `知识库中存在重复角色名「${key}」`,
      });
    } else {
      nameMap.set(key, c);
    }
  }

  for (const c of characters) {
    const aliasList = Array.isArray(c.aliases) ? c.aliases : (c.aliases ? [c.aliases] : []);
    const searchNames = [c.name, ...aliasList].filter(Boolean);
    const found = searchNames.some((a) => {
      if (!a || a.length < 2) return false;
      return fullText.includes(a);
    });
    if (!found && fullText.length > 500) {
      issues.push({
        kind: 'character_missing',
        name: c.name,
        message: `角色「${c.name}」及其别名在扫描范围内未出现`,
      });
    }

    for (const a of aliasList) {
      if (a && a !== c.name && fullText.includes(a) && !fullText.includes(c.name)) {
        issues.push({
          kind: 'alias_only',
          name: c.name,
          alias: a,
          message: `正文仅出现别名「${a}」，未出现 canonical 名「${c.name}」`,
        });
      }
    }

    for (const name of searchNames) {
      if (!name || name.length < 2) continue;
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const hits = (fullText.match(re) || []).length;
      if (hits > 0) nameCounts[name] = (nameCounts[name] || 0) + hits;
    }
  }

  for (const loc of locations) {
    if (!loc || loc.length < 2) continue;
    if (fullText.length > 500 && !fullText.includes(loc)) {
      issues.push({
        kind: 'location_missing',
        name: loc,
        message: `地点「${loc}」在扫描范围内未出现`,
      });
    }
  }

  return {
    schema: 'consistency_check',
    project_id: projectId,
    characters_checked: characters.length,
    locations_checked: locations.length,
    chapters_scanned: chaptersToScan.length,
    issues,
    name_counts: nameCounts,
    updated_at: new Date().toISOString(),
  };
}
