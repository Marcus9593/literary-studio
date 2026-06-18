import { Outlet, useLocation } from 'react-router-dom'
import { BRAND } from '../../lib/brand.js'
import PageSlogan from '../../components/PageSlogan.jsx'
import AiSubnav from './AiSubnav.jsx'

export default function AiCenterPage() {
  const location = useLocation()

  // 路由切换时 key 变化 → 子面板 remount → 自动重新拉取数据
  // 解决「在模型页激活后切回总览需手动刷新」的问题
  const outletKey = location.pathname

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
        <Outlet key={outletKey} />
      </div>
    </div>
  )
}
