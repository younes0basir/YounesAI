import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Cpu, Database, MessageSquare, Wrench, Brain, HardDrive, Trash2 } from 'lucide-react'

const LEVEL_ICON = {
  complete: MessageSquare,
  memory: Database,
  tool: Wrench,
  reason: Brain,
  file: HardDrive,
  info: Cpu,
}

const LEVEL_TONE = {
  complete: 'violet',
  memory: 'amber',
  tool: 'cyan',
  reason: 'emerald',
  file: 'blue',
  info: 'slate',
}

function timeOf(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function DebugView({ log, counters, uptime, onClear }) {
  const boxRef = useRef(null)

  useEffect(() => {
    const el = boxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log.length])

  const uptimeMs = Number.isFinite(uptime) ? Math.max(0, Date.now() - uptime) : 0
  const upMin = Math.floor(uptimeMs / 60000)
  const upSec = Math.floor((uptimeMs % 60000) / 1000)

  return (
    <div className="cc-dbg">
      <div className="cc-dbg-head">
        <div>
          <h3 className="cc-panel-title">Live Engine Log</h3>
          <p className="cc-panel-sub">Raw event stream straight from the simulation core</p>
        </div>
        <div className="cc-dbg-meta">
          <span className="cc-dbg-chip"><Cpu size={11} /> session {upMin}m {upSec}s</span>
          <span className="cc-dbg-chip"><Terminal size={11} /> {log.length} entries</span>
          <button type="button" className="cc-dbg-clear" onClick={onClear} title="Clear the buffer">
            <Trash2 size={12} /> clear
          </button>
        </div>
      </div>

      <div className="cc-dbg-box" ref={boxRef}>
        <div className="cc-dbg-stdout">
          <span className="cc-dbg-caret">younes-ai@core:~$</span> supervisor --watch --stream
        </div>
        <AnimatePresence initial={false}>
          {log.map((l) => {
            const Icon = LEVEL_ICON[l.level] || Cpu
            const tone = LEVEL_TONE[l.level] || 'slate'
            return (
              <motion.div
                key={l.id}
                className={`cc-dbg-line cc-dbg-line-${tone}`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
              >
                <span className="cc-dbg-line-time">{timeOf(l.ts)}</span>
                <span className="cc-dbg-line-icon"><Icon size={11} /></span>
                <span className="cc-dbg-line-text">{l.text}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {log.length === 0 && <div className="cc-dbg-empty">waiting for events…</div>}
      </div>

      <div className="cc-dbg-foot">
        <span className="cc-live-pulse" /> streaming
        <span className="cc-dbg-foot-spacer" />
        <span className="cc-dbg-foot-stat">tokens {Math.round(counters.tokens / 1000)}k</span>
        <span className="cc-dbg-foot-stat">requests {counters.requests || 0}</span>
        <span className="cc-dbg-foot-stat">tools {counters.tools || 0}</span>
      </div>
    </div>
  )
}