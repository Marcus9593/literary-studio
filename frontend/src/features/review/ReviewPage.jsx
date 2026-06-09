import { useToast } from '../../components/Toast.jsx'
import { BRAND } from '../../lib/brand.js'
import ModulePageHeader from '../shared/components/ModulePageHeader.jsx'
import ProjectSelector from '../shared/components/ProjectSelector.jsx'
import { useProjectScope } from '../shared/hooks/useProjectScope.js'
import ReviewPanel from './ReviewPanel.jsx'
import EngineCriticPanel from './EngineCriticPanel.jsx'

export default function ReviewPage() {
  const showToast = useToast()
  const { projects, selectedProjectId, setSelectedProjectId, projectOptions, loading } =
    useProjectScope(showToast)

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <div className="page studio-page">
      <ModulePageHeader
        title={BRAND.review.title}
        intro={BRAND.review.intro}
      />
      <div className="studio-context-bar">
        <ProjectSelector
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          options={projectOptions}
          loading={loading}
        />
      </div>
      {selectedProjectId ? (
        <section className="card story-health-review-embed">
          <EngineCriticPanel
            projectId={selectedProjectId}
            workType={selectedProject?.work_type}
            showToast={showToast}
          />
        </section>
      ) : null}
      <ReviewPanel projectId={selectedProjectId} showToast={showToast} variant="global" />
    </div>
  )
}
