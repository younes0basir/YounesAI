import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Wrench, Brain, FileSearch } from 'lucide-react'
import { TIMELINE_STEPS } from './ccData'

const STEP_DETAIL = {
  request: {
    title: 'User Request',
    rationale: 'The raw message arrives and is normalised before routing.',
    tools: ['normalize_prompt', 'extract_intent'],
    output: '"Create a task for 21 this month named internship"',
  },
  planner: {
    title: 'Planner',
    rationale: 'Intent analysis scores each specialist and picks the primary route.',
    tools: ['intent_classify', 'route_score'],
    output: 'Route → Task Agent (score 0.92)',
  },
  research: {
    title: 'Research Agent',
    rationale: 'Gathers supporting context from indexed documents before acting.',
    tools: ['retrieve_documents', 'rerank_hits', 'summarize_context'],
    output: '3 chunks retrieved · 1 matched task semantics',
  },
  knowledge: {
    title: 'Knowledge Agent',
    rationale: 'Consults the knowledge graph and long-term memory for relevant facts.',
    tools: ['semantic_search', 'graph_lookup'],
    output: 'Memory hit: "internship" → hiring folder',
  },
  coder: {
    title: 'Coder Agent',
    rationale: 'Executes the chosen tool with validated arguments.',
    tools: ['createTask', 'validate_args'],
    output: 'Task saved · id 1821 · due 2026-08-21',
  },
  reviewer: {
    title: 'Reviewer',
    rationale: 'Checks the action and drafted answer for correctness and grounding.',
    tools: ['verify_tool_result', 'groundedness_check'],
    output: 'Grounding 0.94 · hallucination 0%',
  },
  final: {
    title: 'Final Response',
    rationale: 'The orchestrator composes a clean, human-facing reply.',
    tools: ['synthesize', 'format_reply'],
    output: 'Done — task for Aug 21 is set.',
  },
}

export default function AITimeline({ steps, activeStep, onInspect }) {
  return (
    <div className="cc-timeline">
      <div className="cc-timeline-head">
        <span className="cc-timeline-title">AI Pipeline</span>
        <span className="cc-timeline-live">
          <span className="cc-live-pulse" /> live
        </span>
      </div>
      <div className="cc-timeline-track">
        {TIMELINE_STEPS.map((step) => {
          const Icon = step.icon
          const isActive = activeStep === step.id || steps.some((s) => s.id === step.id)
          const isReached = steps.some((s) => s.id === step.id)
          return (
            <motion.button
              key={step.id}
              type="button"
              className={`cc-step ${isActive ? 'is-active' : ''} ${isReached ? 'is-reached' : ''}`}
              onClick={() => onInspect?.(step.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
            >
              <div className="cc-step-meta">
                <span className="cc-step-icon" style={{ background: step.color }}>
                  <Icon size={12} />
                </span>
                <span className="cc-step-label">{step.label}</span>
              </div>
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    className="cc-step-beam"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <span className="cc-step-beam-bar" style={{ background: step.color }} />
                    <span className="cc-step-beam-phase" style={{ color: step.color }}>active</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
        <ChevronRight size={14} className="cc-timeline-arrow" />
      </div>
    </div>
  )
}

export function TimelineInspector({ stepId, onClose }) {
  const step = TIMELINE_STEPS.find((s) => s.id === stepId)
  if (!step) return null
  const detail = STEP_DETAIL[step.id]
  const Icon = step.icon
  return (
    <motion.div
      className="cc-tl-inspector"
      initial={{ opacity: 0, scale: 0.92, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      <button type="button" className="cc-tl-inspector-close" onClick={onClose} aria-label="Close inspector">×</button>
      <div className="cc-tl-inspector-head" style={{ background: `${step.color}14` }}>
        <span className="cc-tl-inspector-icon" style={{ background: step.color }}><Icon size={16} /></span>
        <div>
          <h4>{detail.title}</h4>
          <p>{step.label} · pipeline stage</p>
        </div>
      </div>
      <div className="cc-tl-inspector-body">
        <p className="cc-tl-rationale">{detail.rationale}</p>
        <div className="cc-tl-block">
          <span className="cc-tl-block-label"><Brain size={11} /> Reasoning</span>
          <p>{detail.rationale}</p>
        </div>
        <div className="cc-tl-block">
          <span className="cc-tl-block-label"><Wrench size={11} /> Tool calls</span>
          <div className="cc-tl-tools">
            {detail.tools.map((t) => <span key={t} className="cc-tool-chip">{t}</span>)}
          </div>
        </div>
        <div className="cc-tl-block">
          <span className="cc-tl-block-label"><FileSearch size={11} /> Output</span>
          <pre className="cc-tl-output">{detail.output}</pre>
        </div>
      </div>
    </motion.div>
  )
}