import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageSquare, Brain, Wrench, MemoryStick, Timer, Coins, ChevronRight } from 'lucide-react'

export default function ConversationInspector({ open, agentA, agentB, onClose }) {
  const [tab, setTab] = useState('messages')

  if (!open || !agentA || !agentB) return null

  const tabs = [
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'reasoning', label: 'Reasoning', icon: Brain },
    { id: 'tools', label: 'Tools', icon: Wrench },
    { id: 'memory', label: 'Memory', icon: MemoryStick },
  ]

  const messages = [
    { from: agentA.label.replace(' Agent', ''), to: agentB.label.replace(' Agent', ''), text: `Task: inspect intent "${agentB.label.replace(' Agent', '')} request" and dispatch`, dir: 'to' },
    { from: agentB.label.replace(' Agent', ''), to: agentA.label.replace(' Agent', ''), text: 'Acknowledged. Confidence 0.93. Querying memory…', dir: 'from' },
    { from: agentA.label.replace(' Agent', ''), to: agentB.label.replace(' Agent', ''), text: 'Proceed with best available tool.', dir: 'to' },
    { from: agentB.label.replace(' Agent', ''), to: agentA.label.replace(' Agent', ''), text: 'Done in 412ms. Result grounded (0.94).', dir: 'from' },
  ]

  const reasoning = [
    'Request maps to one explicit specialist.',
    'No cached result — fresh computation required.',
    'Tool arguments pass schema validation.',
    'Provider fallback chain not needed this run.',
  ]

  const tools = [
    { name: 'dispatch_request', status: 'ok', ms: 12 },
    { name: 'retrieve_documents', status: 'ok', ms: 231 },
    { name: 'compose_reply', status: 'ok', ms: 169 },
  ]

  const memoryUpdates = [
    'Wrote new entry: "agent request pattern"',
    'Bumped confidence for task routing',
    'Linked event to existing project node',
  ]

  return (
    <AnimatePresence>
      <motion.div
        className="cc-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="cc-conv"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cc-conv-head">
            <div>
              <h3 className="cc-conv-title">Conversation Inspector</h3>
              <p className="cc-conv-sub">
                <b>{agentA.label}{agentA.icon && ' '}</b>
                <ChevronRight size={12} /> <b>{agentB.label}</b> — message exchange
              </p>
            </div>
            <div className="cc-conv-stats">
              <span className="cc-conv-stat"><Timer size={11} /> 412ms</span>
              <span className="cc-conv-stat"><Coins size={11} /> $0.0009</span>
            </div>
            <button type="button" className="cc-conv-close" onClick={onClose} aria-label="Close inspector">
              <X size={16} />
            </button>
          </div>

          <div className="cc-conv-tabs">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <button key={t.id} type="button" className={`cc-conv-tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
                  <Icon size={12} /> {t.label}
                </button>
              )
            })}
          </div>

          <div className="cc-conv-body">
            <AnimatePresence mode="wait">
              {tab === 'messages' && (
                <motion.div key="messages" className="cc-conv-messages" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  {messages.map((m, i) => (
                    <div key={i} className={`cc-bubble cc-bubble-${m.dir}`}>
                      <span className="cc-bubble-from">{m.from}</span>
                      <p>{m.text}</p>
                      <span className="cc-bubble-time">{400 - i * 90}ms</span>
                    </div>
                  ))}
                </motion.div>
              )}
              {tab === 'reasoning' && (
                <motion.div key="reasoning" className="cc-conv-list" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  {reasoning.map((r, i) => (
                    <div key={i} className="cc-conv-list-item">
                      <Brain size={12} className="cc-conv-list-icon" />
                      <span>{r}</span>
                    </div>
                  ))}
                </motion.div>
              )}
              {tab === 'tools' && (
                <motion.div key="tools" className="cc-conv-list" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  {tools.map((t, i) => (
                    <div key={i} className="cc-conv-tool-row">
                      <Wrench size={12} className="cc-conv-list-icon" />
                      <span className="cc-conv-tool-name">{t.name}</span>
                      <span className="cc-conv-tool-ok">✓ {t.status}</span>
                      <span className="cc-conv-tool-ms">{t.ms}ms</span>
                    </div>
                  ))}
                </motion.div>
              )}
              {tab === 'memory' && (
                <motion.div key="memory" className="cc-conv-list" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  {memoryUpdates.map((m, i) => (
                    <div key={i} className="cc-conv-list-item">
                      <MemoryStick size={12} className="cc-conv-list-icon" />
                      <span>{m}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}