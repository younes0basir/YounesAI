import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Command, CornerDownLeft } from 'lucide-react'
import { PALETTE_COMMANDS } from './ccData'

export default function CommandPalette({ open, onOpen, onClose, onCommand, targetName }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PALETTE_COMMANDS
    return PALETTE_COMMANDS.filter((c) =>
      c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)
    )
  }, [query])

  // Space to open (guarded so typing/space in inputs isn't hijacked)
  useEffect(() => {
    const handler = (e) => {
      if (open) return
      const tag = e.target?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable
      if (e.code === 'Space' && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        onOpen?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const keyHandler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && results[index]) {
        e.preventDefault()
        run(results[index])
      }
    }
    window.addEventListener('keydown', keyHandler)
    return () => window.removeEventListener('keydown', keyHandler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, results])

  const run = (cmd) => {
    onClose()
    onCommand?.(cmd.id, targetName)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cc-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="cc-palette"
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Command palette"
          >
            <div className="cc-palette-input-wrap">
              <Search size={16} className="cc-palette-search-icon" />
              <input
                ref={inputRef}
                className="cc-palette-input"
                placeholder="Create Agent, Assign Task, Run Workflow…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIndex(0) }}
                aria-label="Search commands"
              />
              <span className="cc-palette-kbd"><Command size={10} /> Space</span>
            </div>
            <div className="cc-palette-list" role="listbox">
              {results.length === 0 && (
                <div className="cc-palette-empty">No commands match that query.</div>
              )}
              {results.map((cmd, i) => {
                const Icon = cmd.icon
                const active = i === index
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`cc-palette-item ${active ? 'is-active' : ''}`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => run(cmd)}
                  >
                    <span className="cc-palette-item-icon"><Icon size={15} /></span>
                    <span className="cc-palette-item-label">{cmd.label}</span>
                    <span className="cc-palette-item-hint">{cmd.hint}</span>
                    {active && <CornerDownLeft size={12} className="cc-palette-item-enter" />}
                  </button>
                )
              })}
            </div>
            <div className="cc-palette-foot">
              <span><Command size={10} /> Space to open</span>
              <span>↑↓ navigate · ↵ run · esc close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}