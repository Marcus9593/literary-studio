import { Outlet } from 'react-router-dom'
import { BRAND } from '../../lib/brand.js'
import PageSlogan from '../../components/PageSlogan.jsx'
import AiSubnav from './AiSubnav.jsx'

export default function AiCenterPage() {
  return (
    <div className="page ai-center-page">
      <header className="page-header">
        <div className="page-header-row">
          <div>
            <h2>{BRAND.aiCenter.title}</h2>
            <PageSlogan />
            <p>{BRAND.aiCenter.intro}</p>
          </div>
        </div>
      </header>

      <AiSubnav />

      <div className="ai-center-content">
        <Outlet />
      </div>
    </div>
  )
}
