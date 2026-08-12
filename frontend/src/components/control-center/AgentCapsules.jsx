import { motion } from 'framer-motion'
import { AGENT_AURAS } from './ccData'

function ProgressRing({ percent, color, size = 40 }) {
  const r = (size - 5) / 2
  const c = 2 * Math.PI * r
  const off = c - (percent / 100) * c
  return (
    <svg width={size} height={size} className="cc-ring-svg" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(139,92,246,0.12)" strokeWidth={4} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: off }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
    </svg>
  )
}

export default function AgentCapsules({ agents, live, onOpen }) {
  return (
    <div className="cc-capsule-row">
      {agents.map((a, i) => {
        const ll = live.find((l) => l.name === a.name)?.liveliness
        const online = live.find((l) => l.name === a.name)?.online
        const phase = online ? (ll?.phase || 'idle') : 'resting'
        const aura = AGENT_AURAS[phase] || AGENT_AURAS.idle
        const Icon = a.icon
        const isOrch = a.name === 'orchestrator'
        const success = 92 + ((i * 5) % 8)
        return (
          <motion.button
            key={a.name}
            type="button"
            className={`cc-capsule ${isOrch ? 'cc-capsule-orch' : ''} cc-capsule-${phase}`}
            onClick={() => onOpen(a.name)}
            title={`${a.label} · ${phase}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
            whileHover={{ y: -4, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="cc-capsule-head">
              <span className="cc-avatar" style={{ background: `linear-gradient(135deg, ${a.color}, ${a.color}bb)` }}>
                <Icon size={15} />
              </span>
              <div className="cc-capsule-title">
                <span className="cc-capsule-name">{a.label}</span>
                <span className="cc-capsule-role">{isOrch ? 'Coordinator' : a.model}</span>
              </div>
              <span className="cc-capsule-status" style={{ color: aura.color }}>
                <motion.span
                  className="cc-capsule-dot"
                  style={{ background: aura.color }}
                  animate={phase === 'working' || phase === 'thinking' ? { scale: [1, 1.5, 1] } : {}}
                  transition={phase === 'working' || phase === 'thinking' ? { duration: 1.2, repeat: Infinity } : {}}
                />
                {phase}
              </span>
            </div>
            <div className="cc-capsule-mid">
              <div className="cc-capsule-ring">
                <ProgressRing percent={success} color={a.color} />
                <span className="cc-capsule-ring-label">{success}%</span>
              </div>
              <div className="cc-capsule-objective">
                <span className="cc-objective-label">Objective</span>
                <span className="cc-objective-text">{ll?.task || a.desc}</span>
                <span className="cc-objective-meta">
                  {ll?.lastAction || 'Standing by'} · {Math.round((ll?.tokensUsed || 0) / 1000)}k tok
                </span>
              </div>
            </div>
            <div className="cc-capsule-foot">
              <span className="cc-foot-label">
                <span className="cc-foot-dot" style={{ background: aura.color }} /> Memory
                <b>{Math.round((ll?.memoryUsage || 0) * 100)}%</b>
              </span>
              <span className="cc-foot-label cc-foot-conf">Confidence <b>{ll?.confidence || 0}%</b></span>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}