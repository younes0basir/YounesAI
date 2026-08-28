import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Brain,
  Zap,
  MemoryStick,
  HeartPulse,
  Wrench,
  Pause,
  Play,
  Copy,
  ListTodo,
  Sparkles,
  Cpu,
  Activity,
} from 'lucide-react';
import { AGENT_AURAS } from './ccData';

export default function AgentDetailPanel({ agent, ll, online, onClose, onCommand }) {
  if (!agent) return null;
  const Icon = agent.icon;
  const phase = online ? ll?.phase || 'idle' : 'resting';
  const aura = AGENT_AURAS[phase] || AGENT_AURAS.idle;

  const recentActivity = [
    { icon: Brain, text: ll?.lastAction || 'Standing by', ms: '2m ago' },
    { icon: Wrench, text: 'dispatch_completed', ms: '6m' },
    { icon: MemoryStick, text: 'embedding stored to memory', ms: '11m' },
  ];

  return (
    <AnimatePresence>
      <motion.aside
        className="cc-detail"
        initial={{ opacity: 0, x: 80 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 80 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <div
          className="cc-detail-glow"
          style={{
            background: `radial-gradient(60% 50% at 50% 0%, ${agent.color}22, transparent 70%)`,
          }}
        />
        <div className="cc-detail-topbar">
          <span className={`cc-detail-chip cc-detail-chip-${phase}`}>
            <span className="cc-detail-chip-dot" style={{ background: aura.color }} />
            {phase}
          </span>
          <button
            type="button"
            className="cc-detail-close"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            <X size={15} />
          </button>
        </div>

        <div className="cc-detail-head">
          <motion.span
            className="cc-detail-avatar"
            style={{ background: `linear-gradient(135deg, ${agent.color}, ${agent.color}bb)` }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          >
            <Icon size={22} />
          </motion.span>
          <div>
            <h3 className="cc-detail-name">{agent.label}</h3>
            <p className="cc-detail-desc">{agent.desc}</p>
          </div>
        </div>

        <div className="cc-detail-tags">
          <span className="cc-detail-tag">
            <Cpu size={11} /> {agent.provider}
          </span>
          <span className="cc-detail-tag cc-detail-tag-model">{agent.model}</span>
          {agent.fallback && agent.fallback !== '—' && (
            <span className="cc-detail-tag">↳ {agent.fallback}</span>
          )}
        </div>

        <div className="cc-detail-stats">
          <DetailStat
            icon={HeartPulse}
            label="Success"
            value={ll ? `${92 + ((agent.name?.length || 3) % 8)}%` : '—'}
            tone="emerald"
          />
          <DetailStat
            icon={Activity}
            label="Latency"
            value={ll ? `${180 + (((agent.name?.length || 3) * 23) % 400)}ms` : '—'}
            tone="violet"
          />
          <DetailStat
            icon={Zap}
            label="Tokens"
            value={ll ? `${Math.round((ll.tokensUsed || 0) / 1000)}k` : '—'}
            tone="amber"
          />
          <DetailStat
            icon={MemoryStick}
            label="Memory"
            value={ll ? `${Math.round((ll.memoryUsage || 0) * 100)}%` : '—'}
            tone="cyan"
          />
        </div>

        <div className="cc-detail-section">
          <h4 className="cc-detail-section-title">
            <Brain size={12} /> Current objective
          </h4>
          <p className="cc-detail-objective">{ll?.task || agent.desc}</p>
          <div className="cc-detail-confidence">
            <span className="cc-detail-conf-label">confidence</span>
            <div className="cc-detail-conf-bar">
              <motion.div
                className="cc-detail-conf-fill"
                style={{ background: agent.color }}
                animate={{ width: `${ll?.confidence || 0}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              />
            </div>
            <span className="cc-detail-conf-val">{ll?.confidence || 0}%</span>
          </div>
        </div>

        <div className="cc-detail-section">
          <h4 className="cc-detail-section-title">
            <Sparkles size={12} /> Recent activity
          </h4>
          <div className="cc-detail-activity">
            {recentActivity.map((a, i) => {
              const A = a.icon;
              return (
                <div key={i} className="cc-detail-activity-row">
                  <span className="cc-detail-activity-icon" style={{ color: agent.color }}>
                    <A size={12} />
                  </span>
                  <span className="cc-detail-activity-text">{a.text}</span>
                  <span className="cc-detail-activity-ms">{a.ms}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cc-detail-actions">
          <button
            type="button"
            className="cc-detail-btn cc-detail-btn-primary"
            onClick={() => onCommand?.('assign-task')}
          >
            <ListTodo size={13} /> Assign task
          </button>
          <button
            type="button"
            className="cc-detail-btn"
            onClick={() => onCommand?.(online ? 'pause-agent' : 'resume-agent')}
          >
            {online ? <Pause size={13} /> : <Play size={13} />} {online ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            className="cc-detail-btn"
            onClick={() => onCommand?.('clone-agent')}
          >
            <Copy size={13} /> Clone
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

function DetailStat({ icon: Icon, label, value, tone }) {
  return (
    <div className={`cc-detail-stat cc-detail-stat-${tone}`}>
      <span className="cc-detail-stat-icon">
        <Icon size={13} />
      </span>
      <span className="cc-detail-stat-label">{label}</span>
      <span className="cc-detail-stat-value">{value}</span>
    </div>
  );
}
