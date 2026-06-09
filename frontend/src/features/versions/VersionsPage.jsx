import { useToast } from '../../components/Toast.jsx'
import { BRAND } from '../../lib/brand.js'
import ModulePageHeader from '../shared/components/ModulePageHeader.jsx'
import ProjectSelector from '../shared/components/ProjectSelector.jsx'
import { useProjectScope } from '../shared/hooks/useProjectScope.js'
import VersionsPanel from './VersionsPanel.jsx'

export default function VersionsPage() {
  const showToast = useToast()
  const { selectedProjectId, setSelectedProjectId, projectOptions, loading } =
    useProjectScope(showToast)

  return (
    <div className="page studio-page">
      <ModulePageHeader
        title={BRAND.versions.title}
        intro={BRAND.versions.intro}
      />
      <div className="studio-context-bar">
        <ProjectSelector
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          options={projectOptions}
          loading={loading}
        />
      </div>
      <VersionsPanel projectId={selectedProjectId} showToast={showToast} />
    </div>
  )
}
