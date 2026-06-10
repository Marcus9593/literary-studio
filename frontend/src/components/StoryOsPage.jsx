import StorySubnav from './StorySubnav.jsx'
import PageLoading from './PageLoading.jsx'

/** Story OS 子页统一外壳：导航 + 可滚动内容区 */
export default function StoryOsPage({
  className = '',
  projectTitle,
  loading = false,
  loadingLabel = '加载中…',
  children,
}) {
  return (
    <div className={`page story-os-page ${className}`.trim()}>
      <StorySubnav projectTitle={projectTitle} />
      {loading ? <PageLoading label={loadingLabel} /> : children}
    </div>
  )
}
