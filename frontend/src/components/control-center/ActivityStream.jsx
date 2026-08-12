import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EVENT_KINDS } from './ccData'

export default function ActivityStream({ events, onDismiss }) {
  // Auto-dismiss each float after ~5s
  useEffect(() => {
    if (!events.length) return
    const timers = events.map((e) => setTimeout(() => onDismiss(e.id), 5000))
    return () => timers.forEach(clearTimeout)
  }, [events, onDismiss])

  return (
    <div className="cc-floats" aria-live="polite">
      <AnimatePresence>
        {events.map((e) => {
          const kind = EVENT_KINDS.find((k) => k.kind === e.kind) || EVENT_KINDS[0]
          const Icon = kind.icon
          return (
            <motion.div
              key={e.id}
              className={`cc-float cc-float-${e.tone}`}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.92, transition: { duration: 0.3 } }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              <span className="cc-float-icon"><Icon size={13} /></span>
              <span className="cc-float-text">
                <b>{e.agentLabel}</b> — {e.label}
              </span>
              <span className="cc-float-time">{new Date(e.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}