import { useToast } from '../../components/Toast.jsx'
import { BRAND } from '../../lib/brand.js'
import ModulePageHeader from '../shared/components/ModulePageHeader.jsx'
import CockpitPanel from './CockpitPanel.jsx'

export default function CockpitPage() {
  const showToast = useToast()

  return (
    <div className="page studio-page">
      <ModulePageHeader
        title={BRAND.cockpit.title}
        intro={BRAND.cockpit.intro}
      />
      <CockpitPanel showToast={showToast} />
    </div>
  )
}
