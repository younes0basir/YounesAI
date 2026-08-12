import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, ListTodo, Brain, Wrench, Coins, Activity, Zap, ChevronRight,
  Sparkles,
} from 'lucide-react'

const REASONING_POOL = [
  'Intent parsed — route matched: specialist agent',
  'Confidence threshold met for direct dispatch',
  'Tool args validated against entity schema',
  'Result reconciled across two sources',
  'Fallback chain consulted: Groq → OpenRouter',
]

export default function IntelligencePanel({ counters, live, onNavigate, onToggle, collapsed }) {
  const [reasoning, setReasoning] = useState([
    'Standing by for the next request.',
    'Monitoring provider queue depth.',
  ])

  useEffect(() => {
    if (live.some((l) => l.liveliness?.phase === 'working')) {
      const timer = setInterval(() => {
        setReasoning((prev) => {
          const next = REASONING_POOL[Math.floor(Math.random() * REASONING_POOL.length)]
          if (prev[prev.length - 1] !== next) return [...prev.slice(-3), next]
          return prev
        })
      }, 2200)
      return () => clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.some((l) => l.liveliness?.phase === 'working')])

  const working = live.filter((l) => l.liveliness?.phase === 'working').length
  const thinking = live.filter((l) => l.liveliness?.phase === 'thinking').length
  const runningTools = ['retrieve_documents', 'route_request', 'semantic_search'].filter((_, i) => i < 1 + thinking)

  return (
    <div className={`cc-intel ${collapsed ? 'cc-intel-collapsed' : ''}`}>
      <button type="button" className="cc-intel-toggle" onClick={onToggle} aria-label="Toggle intelligence panel">
        <AnimatePresence mode="wait">
          {collapsed ? (
            <motion.span key="open" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}>
              <ChevronRight size={16} />
            </motion.span>
          ) : (
            <motion.span key="close" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}>
              <ChevronRight size={16} className="cc-intel-chev" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {collapsed ? (
        <div className="cc-intel-collapsed-fab">
          <Target size={16} />
        </div>
      ) : (
        <div className="cc-intel-inner">
          <h3 className="cc-intel-title">Intelligence</h3>

          <Section icon={Target} label="Current Goal">
            <p className="cc-intel-goal-text">
              Orchestrate every request through the most capable specialist, minimising latency.
            </p>
          </Section>

          <Section icon={ListTodo} label="Active Tasks" badge={counters.tasks}>
            <div className="cc-intel-tasks">
              {['Handle inbox triage', 'Verify image pipeline', 'Re-index folder changes'].slice(0, counters.tasks).map((t, i) => (
                <div key={i} className="cc-task-row">
                  <span className={`cc-task-pip cc-task-pip-${i % 3}`} />
                  <span className="cc-task-name">{t}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={Brain} label="Reasoning" livePulse>
            <div className="cc-reason-chain">
              {reasoning.slice(-3).map((r, i) => (
                <motion.div
                  key={`${r}-${i}`}
                  className={`cc-reason-step ${i === reasoning.length - 1 ? 'is-latest' : ''}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span className="cc-reason-dot" />
                  <span>{r}</span>
                </motion.div>
              ))}
            </div>
          </Section>

          <Section icon={Wrench} label="Running Tools" badge={runningTools.length}>
            <div className="cc-tools">
              {runningTools.map((tool) => (
                <motion.span
                  key={tool}
                  className="cc-tool-chip"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  <Wrench size={11} /> {tool}
                </motion.span>
              ))}
            </div>
          </Section>

          <div className="cc-metrics-grid">
            <MiniMetric icon={Zap} label="Tokens" value={counters.tokens > 0 ? `${Math.round(counters.tokens / 1000)}k` : '—'} />
            <MiniMetric icon={Activity} label="Latency" value={counters.latency ? `${counters.latency}ms` : '—'} />
            <MiniMetric icon={Coins} label="Est. cost" value={counters.cost > 0 ? `$${counters.cost.toFixed(4)}` : '—'} />
            <MiniMetric icon={Sparkles} label="Active" value={`${working + thinking} agents`} />
          </div>

          <button type="button" className="cc-intel-action" onClick={() => onNavigate?.('timeline')}>
            Open timeline <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

function Section({ icon: Icon, label, badge, livePulse, children }) {
  return (
    <section className="cc-section">
      <h4 className="cc-section-title">
        <span className="cc-section-icon"><Icon size={12} /></span>
        {label}
        {badge != null && <span className="cc-badge">{badge}</span>}
        {livePulse && <span className="cc-live-pulse" />}
      </h4>
      {children}
    </section>
  )
}

function MiniMetric({ icon: Icon, label, value }) {
  return (
    <div className="cc-metric">
      <span className="cc-metric-icon"><Icon size={12} /></span>
      <span className="cc-metric-label">{label}</span>
      <span className="cc-metric-value">{value}</span>
    </div>
  )
}