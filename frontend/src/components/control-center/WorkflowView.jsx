import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, Send, Bot, Loader2 } from 'lucide-react';
import { TIMELINE_STEPS } from './ccData';

const STAGE_DESC = {
  request: 'The raw prompt is captured, trimmed and normalised before any routing happens.',
  planner: 'Intent scoring picks the specialist with the strongest match for this request.',
  research: 'Supporting context is pulled from documents to ground the answer.',
  knowledge: 'Long-term memory and the knowledge graph are consulted for related facts.',
  coder: 'The chosen tool executes with strictly validated arguments.',
  reviewer: 'A final groundedness + correctness pass guards the reply.',
  final: 'The orchestrator composes a clean, human-facing response.',
};

export default function WorkflowView({ steps, live, onInspect, onFire }) {
  const activeStep = steps[steps.length - 1]?.id || 'request';
  const activeIndex = TIMELINE_STEPS.findIndex((s) => s.id === activeStep);
  const working = live.filter((l) => l.liveliness?.phase === 'working');

  return (
    <div className="cc-wf">
      <div className="cc-wf-head">
        <div>
          <h3 className="cc-panel-title">Request Flow</h3>
          <p className="cc-panel-sub">How one request becomes an answer — stage by stage</p>
        </div>
        <button type="button" className="cc-wf-fire" onClick={onFire}>
          <Loader2 size={13} className="cc-wf-fire-icon" /> Run workflow
        </button>
      </div>

      <div className="cc-wf-stages">
        {TIMELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          const reached = steps.some((s) => s.id === step.id);
          const current = i === activeIndex;
          const done = i < activeIndex;
          return (
            <motion.button
              key={step.id}
              type="button"
              className={`cc-wf-stage ${reached || done ? 'is-reached' : ''} ${current ? 'is-current' : ''}`}
              onClick={() => onInspect?.(step.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="cc-wf-stage-row">
                <span className="cc-wf-stage-icon" style={{ background: step.color }}>
                  {done || (reached && current) ? <Check size={13} /> : <Icon size={13} />}
                </span>
                <div className="cc-wf-stage-text">
                  <span className="cc-wf-stage-label">{step.label}</span>
                  <span className="cc-wf-stage-desc">{STAGE_DESC[step.id]}</span>
                </div>
                {current && (
                  <span
                    className="cc-wf-stage-tag"
                    style={{ color: step.color, background: `${step.color}14` }}
                  >
                    running
                  </span>
                )}
              </div>
              {i < TIMELINE_STEPS.length - 1 && (
                <motion.div
                  className="cc-wf-connector"
                  animate={current ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.25 }}
                  transition={{ duration: 1.4, repeat: current ? Infinity : 0 }}
                >
                  <ChevronRight size={13} />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="cc-wf-foot">
        <div className="cc-wf-live">
          <span className="cc-live-pulse" />
          <span>{working.length} agents currently processing</span>
        </div>
        <div className="cc-wf-tip">
          <Bot size={12} /> Click a stage to inspect its reasoning, tools & output
          <Send size={12} className="cc-wf-tip-end" />
        </div>
      </div>

      <AnimatePresence>
        {steps
          .slice(-5)
          .reverse()
          .slice(0, 3)
          .map((s, idx) => (
            <motion.div
              key={`${s.id}-${s.ts}`}
              className="cc-wf-toast"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <span
                className="cc-wf-toast-dot"
                style={{ background: TIMELINE_STEPS.find((x) => x.id === s.id)?.color }}
              />
              <span className="cc-wf-toast-label">Pipeline advanced to {s.label}</span>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
