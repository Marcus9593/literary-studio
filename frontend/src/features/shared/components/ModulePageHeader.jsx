import PageSlogan from '../../../components/PageSlogan.jsx'

export default function ModulePageHeader({ title, intro, actions = null }) {
  return (
    <header className="page-header">
      <div className="page-header-row">
        <div>
          <h2>{title}</h2>
          <PageSlogan />
          {intro && <p>{intro}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  )
}
