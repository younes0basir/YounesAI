import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this data. Please try again.',
  onRetry,
  bare = false,
}) {
  const wrapper = bare ? 'empty-state empty-state-bare' : 'surface empty-state animate-fade-up'
  return (
    <div className={wrapper} role="alert">
      <div className="empty-state-icon" style={{ background: 'rgba(248, 113, 113, 0.12)', borderColor: 'rgba(248, 113, 113, 0.2)', color: '#b91c1c' }}>
        <AlertTriangle size={28} strokeWidth={1.5} />
      </div>
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {onRetry ? (
        <div className="mt-4">
          <button type="button" onClick={onRetry} className="btn btn-secondary text-sm">
            <RotateCcw size={15} /> Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}
