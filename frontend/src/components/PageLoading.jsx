export default function PageLoading({ label = '加载中…' }) {
  return (
    <div className="page-loading" role="status">
      <div className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>{label}</p>
    </div>
  )
}
