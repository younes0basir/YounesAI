import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Activity } from 'lucide-react'
import { TIMELINE_STEPS } from './ccData'

const STAGE_DESC = {
  request: 'Prompt captured and normalised',
  planner: 'Specialist scoring & routing',
  research: 'Document retrieval + rerank',
  knowledge: 'Memory & graph lookup',
  coder: 'Tool execution with validated args',
  reviewer: 'Groundedness verification',
  final: 'Reply composed and delivered',
}

const STAGE_STATE = {
  request: 'routed',
  planner: 'scored',
  research: 'retrieved',
  knowledge: 'consulted',
  coder: 'executed',
  reviewer: 'verified',
  final: 'delivered',
}

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

export default function TimelineView({ steps, onInspect }) {
  const reached = steps.map((s) => s.id)
  const rows = TIMELINE_STEPS.map((s) => ({
    ...s,
    desc: STAGE_DESC[s.id],
    state: STAGE_STATE[s.id],
    reached: reached.includes(s.id),
    ts: Date.now() - (reached.indexOf(s.id) >= 0 ? (reached.indexOf(s.id) * 9000 + 4000) : 0),
  }))

  return (
    <div className="cc-tlview">
      <div className="cc-tlview-head">
        <div>
          <h3 className="cc-panel-title">Live Run History</h3>
          <p className="cc-panel-sub">Pipeline stages reached by the orchestrator — updated in real time</p>
        </div>
        {steps.length > 0 && (
          <span className="cc-tlview-eta">
            <Activity size={12} /> last update {timeAgo(steps[steps.length - 1].ts)}
          </span>
        )}
      </div>

      <div className="cc-tlview-list">
        {rows.map((s, i) => {
          const done = s.reached
          return (
            <motion.button
              key={`${s.id}-${i}`}
              type="button"
              className={`cc-tlview-row ${done ? 'is-done' : ''}`}
              onClick={() => onInspect?.(s.id)}
              whileHover={{ x: 3 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <span className="cc-tlview-icon" style={{ background: done ? s.color : '#f1f5f9', color: done ? '#fff' : '#94a3b8' }}>
                {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              </span>
              <div className="cc-tlview-main">
                <span className="cc-tlview-label">{s.label}</span>
                <span className="cc-tlview-desc">{done ? s.desc : 'Waiting for the orchestrator to reach this stage…'}</span>
              </div>
              <span className={`cc-tlview-state ${done ? 'is-done' : ''}`}>{done ? s.state : 'pending'}</span>
              <span className="cc-tlview-time">{done ? timeAgo(s.ts) : '—'}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}