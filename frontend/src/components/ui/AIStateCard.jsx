import { Lightbulb, ShieldQuestion, Loader2, CheckCircle2, XCircle } from 'lucide-react'

const STATE_CONFIG = {
  suggestion: { icon: Lightbulb, label: 'Suggested', className: 'ai-state-suggestion' },
  approval: { icon: ShieldQuestion, label: 'Waiting for approval', className: 'ai-state-approval' },
  running: { icon: Loader2, label: 'Running', className: 'ai-state-running', spin: true },
  completed: { icon: CheckCircle2, label: 'Completed', className: 'ai-state-completed' },
  failed: { icon: XCircle, label: 'Failed', className: 'ai-state-failed' },
}

/**
 * Reusable AI execution/state indicator used across Home, Assistant, and Activity.
 * state: 'suggestion' | 'approval' | 'running' | 'completed' | 'failed'
 */
export default function AIStateCard({
  state = 'completed',
  message,
  meta,
  progress,
  actions,
  className = '',
}) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.completed
  const Icon = config.icon

  return (
    <div className={`ai-state-card ${config.className} ${className}`}>
      <div className="ai-state-icon">
        <Icon size={16} strokeWidth={2} className={config.spin ? 'animate-spin' : ''} />
      </div>
      <div className="ai-state-body">
        <div className="ai-state-label">
          {config.label}
          {state === 'running' && <span className="ai-state-pulse" aria-hidden="true" />}
        </div>
        {message ? <div className="ai-state-message">{message}</div> : null}
        {typeof progress === 'number' ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="progress-track flex-1">
              <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">{Math.round(progress)}%</span>
          </div>
        ) : null}
        {meta ? <div className="ai-state-meta">{meta}</div> : null}
        {actions ? <div className="ai-state-actions">{actions}</div> : null}
      </div>
    </div>
  )
}
