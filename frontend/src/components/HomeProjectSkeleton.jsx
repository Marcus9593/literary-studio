export default function HomeProjectSkeleton() {
  return (
    <div className="card-grid home-skeleton-grid" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="project-card project-card-skeleton">
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-tags" />
          <div className="skeleton-line skeleton-meta" />
        </div>
      ))}
    </div>
  )
}
