import { useState, useEffect } from 'react';
import { useScreenplay } from '../hooks/useScreenplay.js';
import SceneBoard from './SceneBoard.jsx';
import CharacterStatsPanel from './CharacterStatsPanel.jsx';
import EpisodeList from './EpisodeList.jsx';
import ForeshadowTracker from './ForeshadowTracker.jsx';
import CharacterArcTracker from './CharacterArcTracker.jsx';
import ShotBoard from './ShotBoard.jsx';

export default function ScreenplayEditor({ project, projectId, onOpenFile }) {
  const {
    screenplay,
    stats,
    loading,
    error,
    load,
    loadStats,
    save,
    addScene,
    editScene,
    removeScene,
    reorderSceneList,
    addEpisode,
    editEpisode,
    removeEpisode,
    addEpisodeScene,
    editEpisodeScene,
    reorderEpisodeSceneList,
    addForeshadow,
    editForeshadow,
    editCharacterArc,
    addShot,
    editShot,
    removeShot,
    reorderShotList,
    editSections,
    editPlatform,
  } = useScreenplay(projectId);

  const [activeTab, setActiveTab] = useState('main');
  const [showStats, setShowStats] = useState(false);

  useEffect(() => { loadStats(); }, [loadStats]);

  const wt = project?.work_type;

  if (loading) {
    return (
      <div className="screenplay-editor-loading">
        <div className="loading-dots"><span /><span /><span /></div>
        <p>加载剧本数据…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screenplay-editor-error">
        <p>加载失败: {error}</p>
        <button type="button" className="btn btn-ghost" onClick={load}>重试</button>
      </div>
    );
  }

  if (!screenplay) {
    return (
      <div className="screenplay-editor-empty">
        <p>未找到剧本数据</p>
      </div>
    );
  }

  // 电影剧本
  if (wt === 'screenplay_film') {
    return (
      <div className="screenplay-editor screenplay-film">
        <div className="screenplay-tabs">
          <button className={activeTab === 'main' ? 'active' : ''} onClick={() => setActiveTab('main')}>场景看板</button>
          <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>角色统计</button>
        </div>
        {activeTab === 'main' && (
          <SceneBoard
            screenplay={screenplay}
            onAddScene={addScene}
            onEditScene={editScene}
            onDeleteScene={removeScene}
            onReorderScenes={reorderSceneList}
          />
        )}
        {activeTab === 'stats' && (
          <CharacterStatsPanel characters={screenplay.characters} scenes={screenplay.scenes} />
        )}
      </div>
    );
  }

  // 剧集剧本
  if (wt === 'screenplay_series') {
    return (
      <div className="screenplay-editor screenplay-series">
        <div className="screenplay-tabs">
          <button className={activeTab === 'main' ? 'active' : ''} onClick={() => setActiveTab('main')}>剧集</button>
          <button className={activeTab === 'foreshadow' ? 'active' : ''} onClick={() => setActiveTab('foreshadow')}>伏笔</button>
          <button className={activeTab === 'arcs' ? 'active' : ''} onClick={() => setActiveTab('arcs')}>角色弧线</button>
        </div>
        {activeTab === 'main' && (
          <EpisodeList
            screenplay={screenplay}
            onAddEpisode={addEpisode}
            onEditEpisode={editEpisode}
            onDeleteEpisode={removeEpisode}
            onAddScene={addEpisodeScene}
            onEditScene={editEpisodeScene}
            onDeleteScene={(epId, scId) => {
              // 删除集内场景需要特殊处理
              const ep = screenplay.episodes?.find(e => e.id === epId);
              if (ep) {
                const scenes = (ep.scenes || []).filter(s => s.id !== scId);
                editEpisode(epId, { scenes });
              }
            }}
          />
        )}
        {activeTab === 'foreshadow' && (
          <ForeshadowTracker
            foreshadows={screenplay.foreshadows}
            episodes={screenplay.episodes}
            onAdd={addForeshadow}
            onUpdate={editForeshadow}
          />
        )}
        {activeTab === 'arcs' && (
          <CharacterArcTracker
            characterArcs={screenplay.character_arcs}
            episodes={screenplay.episodes}
            onUpdate={editCharacterArc}
          />
        )}
      </div>
    );
  }

  // 短视频脚本
  if (wt === 'web_short') {
    return (
      <div className="screenplay-editor web-short">
        <ShotBoard
          screenplay={screenplay}
          onAddShot={addShot}
          onEditShot={editShot}
          onDeleteShot={removeShot}
          onReorderShots={reorderShotList}
          onEditSections={editSections}
          onEditPlatform={editPlatform}
        />
      </div>
    );
  }

  return (
    <div className="screenplay-editor-empty">
      <p>未知剧本类型: {wt}</p>
    </div>
  );
}
