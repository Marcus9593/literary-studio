import { Router } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import * as store from './storage.js';
import { ensureProjectAccess, requireProjectWrite } from './auth/project-access.js';

const router = Router();

function pid(req) { return req.params.id; }

function ensureScreenplay(req, res, next) {
  const sp = store.loadScreenplay(pid(req));
  if (!sp) return res.status(404).json({ error: '该项目不是剧本类型' });
  req.screenplay = sp;
  next();
}

const base = '/projects/:id/screenplay';

router.use(base, ensureProjectAccess);
router.use(base, (req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method)) return next();
  return requireProjectWrite(req, res, next);
});

// ── 通用：加载/更新 screenplay.json ──

router.get(base, ensureScreenplay, (req, res) => {
  res.json(req.screenplay);
});

router.patch(base, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const patch = req.body || {};
    Object.assign(sp, patch);
    store.saveScreenplay(pid(req), sp);
    res.json(sp);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 通用：统计 ──

router.get(`${base}/stats`, ensureScreenplay, (req, res) => {
  const sp = req.screenplay;
  const meta = store.getProject(pid(req));
  const wt = meta.work_type;

  if (wt === 'screenplay_film' || wt === 'screenplay_series') {
    const scenes = wt === 'screenplay_film'
      ? sp.scenes || []
      : (sp.episodes || []).flatMap(ep => ep.scenes || []);

    const charMap = {};
    for (const sc of scenes) {
      for (const ch of (sc.characters || [])) {
        if (!charMap[ch]) charMap[ch] = { count: 0, scenes: [] };
        charMap[ch].count++;
        charMap[ch].scenes.push(sc.id);
      }
    }

    const actBreakdown = {};
    for (const sc of scenes) {
      const act = sc.act || 0;
      if (!actBreakdown[act]) actBreakdown[act] = { count: 0, duration: 0 };
      actBreakdown[act].count++;
      actBreakdown[act].duration += sc.duration_estimate || 0;
    }

    const storylineBreakdown = {};
    for (const sc of scenes) {
      const sl = sc.storyline || 'unassigned';
      if (!storylineBreakdown[sl]) storylineBreakdown[sl] = 0;
      storylineBreakdown[sl]++;
    }

    return res.json({
      work_type: wt,
      total_scenes: scenes.length,
      total_duration_estimate: scenes.reduce((s, sc) => s + (sc.duration_estimate || 0), 0),
      characters: charMap,
      act_breakdown: actBreakdown,
      storyline_breakdown: storylineBreakdown,
      ...(wt === 'screenplay_series' ? {
        total_episodes: (sp.episodes || []).length,
        foreshadows_open: (sp.foreshadows || []).filter(f => f.status === 'open').length,
        foreshadows_total: (sp.foreshadows || []).length,
      } : {}),
    });
  }

  if (wt === 'web_short') {
    const shots = sp.shots || [];
    const sectionBreakdown = {};
    for (const sec of (sp.sections || [])) {
      sectionBreakdown[sec.id] = { label: sec.label, type: sec.type, shots: 0, duration: 0 };
    }
    for (const sh of shots) {
      const sec = sectionBreakdown[sh.section_id];
      if (sec) { sec.shots++; sec.duration += sh.duration || 0; }
    }
    return res.json({
      work_type: wt,
      total_shots: shots.length,
      total_duration: shots.reduce((s, sh) => s + (sh.duration || 0), 0),
      target_duration: sp.target_duration || 60,
      platform: sp.platform || 'douyin',
      section_breakdown: sectionBreakdown,
    });
  }

  res.json({ work_type: wt });
});

// ── 电影剧本：场景 CRUD ──

router.post(`${base}/scenes`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    if (sp.schema !== 'screenplay_film') return res.status(400).json({ error: '仅限电影剧本' });

    const body = req.body || {};
    const sceneId = `sc_${randomUUID().slice(0, 8)}`;
    const number = (sp.scenes || []).length + 1;
    const filename = `第${String(number).padStart(3, '0')}场-${body.location || '未命名'}.md`;

    // 创建 .md 文件
    const ws = store.workspacePath(pid(req));
    const mdPath = path.join(ws, '正文', filename);
    fs.mkdirSync(path.dirname(mdPath), { recursive: true });
    const heading = `${body.int_ext || 'INT'} - ${body.location || '未命名'} - ${body.time_of_day || '日'}`;
    fs.writeFileSync(mdPath, `# 场景 ${number}：${heading}\n\n`, 'utf-8');

    const scene = {
      id: sceneId,
      number,
      int_ext: body.int_ext || 'INT',
      location: body.location || '未命名',
      time_of_day: body.time_of_day || '日',
      characters: body.characters || [],
      storyline: body.storyline || 'main',
      act: body.act || 1,
      duration_estimate: body.duration_estimate || 2,
      synopsis: body.synopsis || '',
      filename,
      sort_order: (sp.scenes || []).length,
      tags: body.tags || [],
    };

    sp.scenes = [...(sp.scenes || []), scene];
    store.saveScreenplay(pid(req), sp);
    store.touchProject(pid(req));
    res.json(scene);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch(`${base}/scenes/:sceneId`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const idx = (sp.scenes || []).findIndex(s => s.id === req.params.sceneId);
    if (idx === -1) return res.status(404).json({ error: '场景不存在' });

    const patch = req.body || {};
    sp.scenes[idx] = { ...sp.scenes[idx], ...patch };
    store.saveScreenplay(pid(req), sp);
    res.json(sp.scenes[idx]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete(`${base}/scenes/:sceneId`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const scene = (sp.scenes || []).find(s => s.id === req.params.sceneId);
    if (!scene) return res.status(404).json({ error: '场景不存在' });

    // 删除 .md 文件
    if (scene.filename) {
      try {
        const ws = store.workspacePath(pid(req));
        fs.unlinkSync(path.join(ws, '正文', scene.filename));
      } catch {}
    }

    sp.scenes = sp.scenes.filter(s => s.id !== req.params.sceneId);
    store.saveScreenplay(pid(req), sp);
    res.json({ status: 'deleted', sceneId: req.params.sceneId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post(`${base}/scenes/reorder`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const order = req.body?.order;
    if (!Array.isArray(order)) return res.status(400).json({ error: '需要 order 数组' });

    const sceneMap = new Map((sp.scenes || []).map(s => [s.id, s]));
    const reordered = [];
    for (let i = 0; i < order.length; i++) {
      const scene = sceneMap.get(order[i]);
      if (scene) {
        scene.sort_order = i;
        scene.number = i + 1;
        reordered.push(scene);
      }
    }
    sp.scenes = reordered;
    store.saveScreenplay(pid(req), sp);
    res.json({ status: 'reordered', count: reordered.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 电影剧本：故事线 ──

router.get(`${base}/storylines`, ensureScreenplay, (req, res) => {
  res.json(req.screenplay.storylines || []);
});

router.put(`${base}/storylines`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    sp.storylines = req.body || [];
    store.saveScreenplay(pid(req), sp);
    res.json(sp.storylines);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 电影剧本：角色统计 ──

router.get(`${base}/characters`, ensureScreenplay, (req, res) => {
  const sp = req.screenplay;
  const scenes = sp.scenes || [];
  const charMap = {};

  for (const sc of scenes) {
    for (const ch of (sc.characters || [])) {
      if (!charMap[ch]) {
        charMap[ch] = { name: ch, scene_count: 0, appearances: [], acts: new Set() };
      }
      charMap[ch].scene_count++;
      charMap[ch].appearances.push(sc.id);
      if (sc.act) charMap[ch].acts.add(sc.act);
    }
  }

  // 转换 Set 为数组
  for (const ch of Object.values(charMap)) {
    ch.acts = [...ch.acts];
  }

  res.json(charMap);
});

// ── 剧集：集 CRUD ──

router.post(`${base}/episodes`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    if (sp.schema !== 'screenplay_series') return res.status(400).json({ error: '仅限剧集剧本' });

    const body = req.body || {};
    const episodeId = `ep_${randomUUID().slice(0, 8)}`;
    const season = body.season || 1;
    const number = (sp.episodes || []).filter(ep => ep.season === season).length + 1;
    const filename = `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}-${body.title || '未命名'}.md`;

    // 创建 .md 文件
    const ws = store.workspacePath(pid(req));
    const mdPath = path.join(ws, '正文', filename);
    fs.mkdirSync(path.dirname(mdPath), { recursive: true });
    fs.writeFileSync(mdPath, `# 第${season}季第${number}集：${body.title || '未命名'}\n\n`, 'utf-8');

    const episode = {
      id: episodeId,
      season,
      number,
      title: body.title || '未命名',
      filename,
      timeline: body.timeline || 'present',
      end_hook: body.end_hook || '',
      scenes: [],
      foreshadows_planted: [],
      foreshadows_resolved: [],
    };

    sp.episodes = [...(sp.episodes || []), episode];
    store.saveScreenplay(pid(req), sp);
    res.json(episode);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch(`${base}/episodes/:episodeId`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const idx = (sp.episodes || []).findIndex(ep => ep.id === req.params.episodeId);
    if (idx === -1) return res.status(404).json({ error: '剧集不存在' });

    const patch = req.body || {};
    sp.episodes[idx] = { ...sp.episodes[idx], ...patch };
    store.saveScreenplay(pid(req), sp);
    res.json(sp.episodes[idx]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete(`${base}/episodes/:episodeId`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const episode = (sp.episodes || []).find(ep => ep.id === req.params.episodeId);
    if (!episode) return res.status(404).json({ error: '剧集不存在' });

    // 删除 .md 文件
    if (episode.filename) {
      try {
        const ws = store.workspacePath(pid(req));
        fs.unlinkSync(path.join(ws, '正文', episode.filename));
      } catch {}
    }

    sp.episodes = sp.episodes.filter(ep => ep.id !== req.params.episodeId);
    store.saveScreenplay(pid(req), sp);
    res.json({ status: 'deleted', episodeId: req.params.episodeId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 剧集：集内场景 CRUD ──

router.post(`${base}/episodes/:episodeId/scenes`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const episode = (sp.episodes || []).find(ep => ep.id === req.params.episodeId);
    if (!episode) return res.status(404).json({ error: '剧集不存在' });

    const body = req.body || {};
    const sceneId = `sc_${randomUUID().slice(0, 8)}`;
    const number = (episode.scenes || []).length + 1;

    const scene = {
      id: sceneId,
      number,
      int_ext: body.int_ext || 'INT',
      location: body.location || '未命名',
      time_of_day: body.time_of_day || '日',
      characters: body.characters || [],
      storyline: body.storyline || 'main',
      timeline: body.timeline || episode.timeline || 'present',
      synopsis: body.synopsis || '',
      sort_order: (episode.scenes || []).length,
    };

    episode.scenes = [...(episode.scenes || []), scene];
    store.saveScreenplay(pid(req), sp);
    res.json(scene);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch(`${base}/episodes/:episodeId/scenes/:sceneId`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const episode = (sp.episodes || []).find(ep => ep.id === req.params.episodeId);
    if (!episode) return res.status(404).json({ error: '剧集不存在' });

    const idx = (episode.scenes || []).findIndex(sc => sc.id === req.params.sceneId);
    if (idx === -1) return res.status(404).json({ error: '场景不存在' });

    const patch = req.body || {};
    episode.scenes[idx] = { ...episode.scenes[idx], ...patch };
    store.saveScreenplay(pid(req), sp);
    res.json(episode.scenes[idx]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post(`${base}/episodes/:episodeId/scenes/reorder`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const episode = (sp.episodes || []).find(ep => ep.id === req.params.episodeId);
    if (!episode) return res.status(404).json({ error: '剧集不存在' });

    const order = req.body?.order;
    if (!Array.isArray(order)) return res.status(400).json({ error: '需要 order 数组' });

    const sceneMap = new Map((episode.scenes || []).map(s => [s.id, s]));
    const reordered = [];
    for (let i = 0; i < order.length; i++) {
      const scene = sceneMap.get(order[i]);
      if (scene) {
        scene.sort_order = i;
        scene.number = i + 1;
        reordered.push(scene);
      }
    }
    episode.scenes = reordered;
    store.saveScreenplay(pid(req), sp);
    res.json({ status: 'reordered', count: reordered.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 剧集：伏笔管理 ──

router.get(`${base}/foreshadows`, ensureScreenplay, (req, res) => {
  res.json(req.screenplay.foreshadows || []);
});

router.put(`${base}/foreshadows`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    sp.foreshadows = req.body || [];
    store.saveScreenplay(pid(req), sp);
    res.json(sp.foreshadows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post(`${base}/foreshadows`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const body = req.body || {};
    const foreshadow = {
      id: `fs_${randomUUID().slice(0, 8)}`,
      content: body.content || '',
      planted_episode: body.planted_episode || null,
      resolved_episode: null,
      status: 'open',
    };
    sp.foreshadows = [...(sp.foreshadows || []), foreshadow];
    store.saveScreenplay(pid(req), sp);
    res.json(foreshadow);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch(`${base}/foreshadows/:foreshadowId`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const idx = (sp.foreshadows || []).findIndex(f => f.id === req.params.foreshadowId);
    if (idx === -1) return res.status(404).json({ error: '伏笔不存在' });

    const patch = req.body || {};
    sp.foreshadows[idx] = { ...sp.foreshadows[idx], ...patch };
    store.saveScreenplay(pid(req), sp);
    res.json(sp.foreshadows[idx]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 剧集：角色弧线 ──

router.get(`${base}/character-arcs`, ensureScreenplay, (req, res) => {
  res.json(req.screenplay.character_arcs || {});
});

router.patch(`${base}/character-arcs/:characterName`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const name = decodeURIComponent(req.params.characterName);
    if (!sp.character_arcs) sp.character_arcs = {};

    const patch = req.body || {};
    sp.character_arcs[name] = { ...(sp.character_arcs[name] || {}), ...patch };
    store.saveScreenplay(pid(req), sp);
    res.json(sp.character_arcs[name]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 短视频：分镜 CRUD ──

router.post(`${base}/shots`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    if (sp.schema !== 'web_short') return res.status(400).json({ error: '仅限短视频脚本' });

    const body = req.body || {};
    const shotId = `sh_${randomUUID().slice(0, 8)}`;
    const number = (sp.shots || []).length + 1;
    const filename = `短视频-${String(number).padStart(3, '0')}.md`;

    // 创建 .md 文件
    const ws = store.workspacePath(pid(req));
    const mdPath = path.join(ws, '正文', filename);
    fs.mkdirSync(path.dirname(mdPath), { recursive: true });
    fs.writeFileSync(mdPath, `# 分镜 ${number}\n\n## 画面\n\n${body.visual || ''}\n\n## 字幕\n\n${body.subtitle || ''}\n\n## 旁白\n\n${body.narration || ''}\n`, 'utf-8');

    const shot = {
      id: shotId,
      section_id: body.section_id || 'sec_content',
      number,
      visual: body.visual || '',
      subtitle: body.subtitle || '',
      narration: body.narration || '',
      music: body.music || '',
      duration: body.duration || 3,
      camera_note: body.camera_note || '',
      filename,
      sort_order: (sp.shots || []).length,
    };

    sp.shots = [...(sp.shots || []), shot];
    store.saveScreenplay(pid(req), sp);
    res.json(shot);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch(`${base}/shots/:shotId`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const idx = (sp.shots || []).findIndex(sh => sh.id === req.params.shotId);
    if (idx === -1) return res.status(404).json({ error: '分镜不存在' });

    const patch = req.body || {};
    sp.shots[idx] = { ...sp.shots[idx], ...patch };
    store.saveScreenplay(pid(req), sp);
    res.json(sp.shots[idx]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete(`${base}/shots/:shotId`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const shot = (sp.shots || []).find(sh => sh.id === req.params.shotId);
    if (!shot) return res.status(404).json({ error: '分镜不存在' });

    // 删除 .md 文件
    if (shot.filename) {
      try {
        const ws = store.workspacePath(pid(req));
        fs.unlinkSync(path.join(ws, '正文', shot.filename));
      } catch {}
    }

    sp.shots = sp.shots.filter(sh => sh.id !== req.params.shotId);
    store.saveScreenplay(pid(req), sp);
    res.json({ status: 'deleted', shotId: req.params.shotId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post(`${base}/shots/reorder`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const order = req.body?.order;
    if (!Array.isArray(order)) return res.status(400).json({ error: '需要 order 数组' });

    const shotMap = new Map((sp.shots || []).map(sh => [sh.id, sh]));
    const reordered = [];
    for (let i = 0; i < order.length; i++) {
      const shot = shotMap.get(order[i]);
      if (shot) {
        shot.sort_order = i;
        shot.number = i + 1;
        reordered.push(shot);
      }
    }
    sp.shots = reordered;
    store.saveScreenplay(pid(req), sp);
    res.json({ status: 'reordered', count: reordered.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 短视频：段落定义 ──

router.put(`${base}/sections`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    sp.sections = req.body || [];
    store.saveScreenplay(pid(req), sp);
    res.json(sp.sections);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 短视频：节奏分析 ──

router.get(`${base}/rhythm`, ensureScreenplay, (req, res) => {
  const sp = req.screenplay;
  const shots = sp.shots || [];
  const sections = sp.sections || [];

  const totalDuration = shots.reduce((s, sh) => s + (sh.duration || 0), 0);
  const targetDuration = sp.target_duration || 60;

  const sectionAnalysis = sections.map(sec => {
    const secShots = shots.filter(sh => sh.section_id === sec.id);
    const secDuration = secShots.reduce((s, sh) => s + (sh.duration || 0), 0);
    return {
      ...sec,
      actual_shots: secShots.length,
      actual_duration: secDuration,
      target_duration: sec.duration,
      ratio: sec.duration > 0 ? (secDuration / sec.duration) : 0,
    };
  });

  const pacing = shots.map((sh, i) => ({
    shot_id: sh.id,
    number: sh.number,
    duration: sh.duration || 0,
    type: (sections.find(s => s.id === sh.section_id) || {}).type || 'content',
  }));

  res.json({
    total_duration: totalDuration,
    target_duration: targetDuration,
    over_target: totalDuration > targetDuration,
    section_analysis: sectionAnalysis,
    pacing,
    rhythm_profile: sp.rhythm_profile || {},
  });
});

// ── 短视频：平台设置 ──

router.put(`${base}/platform`, ensureScreenplay, (req, res) => {
  try {
    const sp = req.screenplay;
    const { platform, target_duration } = req.body || {};
    if (platform) sp.platform = platform;
    if (target_duration) sp.target_duration = target_duration;
    store.saveScreenplay(pid(req), sp);
    res.json({ platform: sp.platform, target_duration: sp.target_duration });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── 导出：Fountain 格式 ──

router.get(`${base}/export/fountain`, ensureScreenplay, (req, res) => {
  const sp = req.screenplay;
  const meta = store.getProject(pid(req));

  if (sp.schema !== 'screenplay_film') {
    return res.status(400).json({ error: 'Fountain 导出仅支持电影剧本' });
  }

  const lines = [];
  lines.push(`Title: ${meta.title}`);
  lines.push(`Credit: 编剧`);
  lines.push(`Draft date: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  for (const scene of (sp.scenes || [])) {
    // 场景标题
    lines.push(`${scene.int_ext || 'INT'}. ${scene.location || '未命名'} - ${scene.time_of_day || '日'}`);
    lines.push('');

    // 读取 .md 文件内容
    if (scene.filename) {
      try {
        const ws = store.workspacePath(pid(req));
        const content = fs.readFileSync(path.join(ws, '正文', scene.filename), 'utf-8');
        // 去掉标题行，保留正文
        const body = content.replace(/^#[^\n]*\n+/, '').trim();
        if (body) {
          lines.push(body);
          lines.push('');
        }
      } catch {}
    }
  }

  const fountain = lines.join('\n');
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${meta.title}.fountain"`);
  res.send(fountain);
});

export default router;
