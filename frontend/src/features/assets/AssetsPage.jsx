import { Link } from 'react-router-dom'
import { useToast } from '../../components/Toast.jsx'
import { BRAND } from '../../lib/brand.js'
import ModulePageHeader from '../shared/components/ModulePageHeader.jsx'
import ProjectSelector from '../shared/components/ProjectSelector.jsx'
import { useProjectScope } from '../shared/hooks/useProjectScope.js'
import AssetsPanel from './AssetsPanel.jsx'

export default function AssetsPage() {
  const showToast = useToast()
  const { selectedProjectId, setSelectedProjectId, projectOptions, loading } =
    useProjectScope(showToast)

  return (
    <div className="page studio-page">
      <ModulePageHeader
        title={BRAND.assets.title}
        intro={BRAND.assets.intro}
      />
      <div className="studio-context-bar">
        <ProjectSelector
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          options={projectOptions}
          loading={loading}
        />
      </div>
      {selectedProjectId && (
        <div className="assets-knowledge-banner card">
          <p>
            <strong>素材中心</strong> 存放跨项目备忘；当前作品的设定、实体与知识图谱在
            {' '}
            <Link to={`/projects/${selectedProjectId}/knowledge`}>作品知识</Link>
            {' '}
            中维护（与「创作素材」区块同步）。
          </p>
        </div>
      )}
      <AssetsPanel projectId={selectedProjectId} showToast={showToast} />
    </div>
  )
}
