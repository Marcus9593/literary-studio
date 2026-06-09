import { useState, useCallback, useEffect } from 'react';
import {
  getScreenplay,
  updateScreenplay,
  createScene,
  updateScene,
  deleteScene,
  reorderScenes,
  getScreenplayStats,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  createEpisodeScene,
  updateEpisodeScene,
  reorderEpisodeScenes,
  getForeshadows,
  createForeshadow,
  updateForeshadow,
  getCharacterArcs,
  updateCharacterArc,
  createShot,
  updateShot,
  deleteShot,
  reorderShots,
  updateSections,
  getRhythm,
  updatePlatform,
  getStorylines,
  updateStorylines,
  getScreenplayCharacters,
  exportFountainUrl,
} from '../../../api.js';

export function useScreenplay(projectId) {
  const [screenplay, setScreenplay] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storylines, setStorylines] = useState(null);
  const [screenplayCharacters, setScreenplayCharacters] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await getScreenplay(projectId);
      setScreenplay(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadStats = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await getScreenplayStats(projectId);
      setStats(data);
    } catch {}
  }, [projectId]);

  const loadStorylines = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await getStorylines(projectId);
      setStorylines(data);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [projectId]);

  const loadScreenplayCharacters = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await getScreenplayCharacters(projectId);
      setScreenplayCharacters(data);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [projectId]);

  const saveStorylines = useCallback(async (lines) => {
    const updated = await updateStorylines(projectId, lines);
    setStorylines(updated);
    return updated;
  }, [projectId]);

  const fountainExportUrl = projectId ? exportFountainUrl(projectId) : '';

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch) => {
    const updated = await updateScreenplay(projectId, patch);
    setScreenplay(updated);
    return updated;
  }, [projectId]);

  // ── 电影剧本：场景 ──

  const addScene = useCallback(async (sceneData) => {
    const scene = await createScene(projectId, sceneData);
    setScreenplay(prev => prev ? { ...prev, scenes: [...(prev.scenes || []), scene] } : prev);
    await loadStats();
    return scene;
  }, [projectId, loadStats]);

  const editScene = useCallback(async (sceneId, patch) => {
    const updated = await updateScene(projectId, sceneId, patch);
    setScreenplay(prev => {
      if (!prev) return prev;
      const scenes = (prev.scenes || []).map(s => s.id === sceneId ? updated : s);
      return { ...prev, scenes };
    });
    return updated;
  }, [projectId]);

  const removeScene = useCallback(async (sceneId) => {
    await deleteScene(projectId, sceneId);
    setScreenplay(prev => {
      if (!prev) return prev;
      const scenes = (prev.scenes || []).filter(s => s.id !== sceneId);
      return { ...prev, scenes };
    });
    await loadStats();
  }, [projectId, loadStats]);

  const reorderSceneList = useCallback(async (order) => {
    await reorderScenes(projectId, order);
    setScreenplay(prev => {
      if (!prev) return prev;
      const sceneMap = new Map((prev.scenes || []).map(s => [s.id, s]));
      const reordered = order.map((id, i) => {
        const scene = sceneMap.get(id);
        return scene ? { ...scene, sort_order: i, number: i + 1 } : null;
      }).filter(Boolean);
      return { ...prev, scenes: reordered };
    });
  }, [projectId]);

  // ── 剧集：集管理 ──

  const addEpisode = useCallback(async (episodeData) => {
    const episode = await createEpisode(projectId, episodeData);
    setScreenplay(prev => prev ? { ...prev, episodes: [...(prev.episodes || []), episode] } : prev);
    return episode;
  }, [projectId]);

  const editEpisode = useCallback(async (episodeId, patch) => {
    const updated = await updateEpisode(projectId, episodeId, patch);
    setScreenplay(prev => {
      if (!prev) return prev;
      const episodes = (prev.episodes || []).map(ep => ep.id === episodeId ? updated : ep);
      return { ...prev, episodes };
    });
    return updated;
  }, [projectId]);

  const removeEpisode = useCallback(async (episodeId) => {
    await deleteEpisode(projectId, episodeId);
    setScreenplay(prev => {
      if (!prev) return prev;
      const episodes = (prev.episodes || []).filter(ep => ep.id !== episodeId);
      return { ...prev, episodes };
    });
  }, [projectId]);

  // ── 剧集：集内场景 ──

  const addEpisodeScene = useCallback(async (episodeId, sceneData) => {
    const scene = await createEpisodeScene(projectId, episodeId, sceneData);
    setScreenplay(prev => {
      if (!prev) return prev;
      const episodes = (prev.episodes || []).map(ep => {
        if (ep.id !== episodeId) return ep;
        return { ...ep, scenes: [...(ep.scenes || []), scene] };
      });
      return { ...prev, episodes };
    });
    return scene;
  }, [projectId]);

  const editEpisodeScene = useCallback(async (episodeId, sceneId, patch) => {
    const updated = await updateEpisodeScene(projectId, episodeId, sceneId, patch);
    setScreenplay(prev => {
      if (!prev) return prev;
      const episodes = (prev.episodes || []).map(ep => {
        if (ep.id !== episodeId) return ep;
        const scenes = (ep.scenes || []).map(sc => sc.id === sceneId ? updated : sc);
        return { ...ep, scenes };
      });
      return { ...prev, episodes };
    });
    return updated;
  }, [projectId]);

  const reorderEpisodeSceneList = useCallback(async (episodeId, order) => {
    await reorderEpisodeScenes(projectId, episodeId, order);
    setScreenplay(prev => {
      if (!prev) return prev;
      const episodes = (prev.episodes || []).map(ep => {
        if (ep.id !== episodeId) return ep;
        const sceneMap = new Map((ep.scenes || []).map(s => [s.id, s]));
        const reordered = order.map((id, i) => {
          const scene = sceneMap.get(id);
          return scene ? { ...scene, sort_order: i, number: i + 1 } : null;
        }).filter(Boolean);
        return { ...ep, scenes: reordered };
      });
      return { ...prev, episodes };
    });
  }, [projectId]);

  // ── 剧集：伏笔 ──

  const addForeshadow = useCallback(async (foreshadowData) => {
    const foreshadow = await createForeshadow(projectId, foreshadowData);
    setScreenplay(prev => prev ? { ...prev, foreshadows: [...(prev.foreshadows || []), foreshadow] } : prev);
    return foreshadow;
  }, [projectId]);

  const editForeshadow = useCallback(async (foreshadowId, patch) => {
    const updated = await updateForeshadow(projectId, foreshadowId, patch);
    setScreenplay(prev => {
      if (!prev) return prev;
      const foreshadows = (prev.foreshadows || []).map(f => f.id === foreshadowId ? updated : f);
      return { ...prev, foreshadows };
    });
    return updated;
  }, [projectId]);

  // ── 剧集：角色弧线 ──

  const editCharacterArc = useCallback(async (characterName, patch) => {
    const updated = await updateCharacterArc(projectId, characterName, patch);
    setScreenplay(prev => {
      if (!prev) return prev;
      return { ...prev, character_arcs: { ...(prev.character_arcs || {}), [characterName]: updated } };
    });
    return updated;
  }, [projectId]);

  // ── 短视频：分镜 ──

  const addShot = useCallback(async (shotData) => {
    const shot = await createShot(projectId, shotData);
    setScreenplay(prev => prev ? { ...prev, shots: [...(prev.shots || []), shot] } : prev);
    await loadStats();
    return shot;
  }, [projectId, loadStats]);

  const editShot = useCallback(async (shotId, patch) => {
    const updated = await updateShot(projectId, shotId, patch);
    setScreenplay(prev => {
      if (!prev) return prev;
      const shots = (prev.shots || []).map(sh => sh.id === shotId ? updated : sh);
      return { ...prev, shots };
    });
    return updated;
  }, [projectId]);

  const removeShot = useCallback(async (shotId) => {
    await deleteShot(projectId, shotId);
    setScreenplay(prev => {
      if (!prev) return prev;
      const shots = (prev.shots || []).filter(sh => sh.id !== shotId);
      return { ...prev, shots };
    });
    await loadStats();
  }, [projectId, loadStats]);

  const reorderShotList = useCallback(async (order) => {
    await reorderShots(projectId, order);
    setScreenplay(prev => {
      if (!prev) return prev;
      const shotMap = new Map((prev.shots || []).map(sh => [sh.id, sh]));
      const reordered = order.map((id, i) => {
        const shot = shotMap.get(id);
        return shot ? { ...shot, sort_order: i, number: i + 1 } : null;
      }).filter(Boolean);
      return { ...prev, shots: reordered };
    });
  }, [projectId]);

  const editSections = useCallback(async (sections) => {
    const updated = await updateSections(projectId, sections);
    setScreenplay(prev => prev ? { ...prev, sections: updated } : prev);
    return updated;
  }, [projectId]);

  const editPlatform = useCallback(async (settings) => {
    const updated = await updatePlatform(projectId, settings);
    setScreenplay(prev => prev ? { ...prev, ...updated } : prev);
    return updated;
  }, [projectId]);

  return {
    screenplay,
    stats,
    loading,
    error,
    load,
    loadStats,
    save,
    // 电影剧本
    addScene,
    editScene,
    removeScene,
    reorderSceneList,
    // 剧集
    addEpisode,
    editEpisode,
    removeEpisode,
    addEpisodeScene,
    editEpisodeScene,
    reorderEpisodeSceneList,
    addForeshadow,
    editForeshadow,
    editCharacterArc,
    // 短视频
    addShot,
    editShot,
    removeShot,
    reorderShotList,
    editSections,
    editPlatform,
    storylines,
    screenplayCharacters,
    loadStorylines,
    loadScreenplayCharacters,
    saveStorylines,
    fountainExportUrl,
  };
}
