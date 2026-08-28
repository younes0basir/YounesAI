import { motion } from 'framer-motion';
import { WORKSPACE_MODES } from './ccData';

export default function ModeTabs({ mode, onChange }) {
  return (
    <div className="cc-modes" role="tablist" aria-label="Workspace views">
      {WORKSPACE_MODES.map((m) => {
        const active = mode === m.id;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`cc-mode ${active ? 'is-active' : ''}`}
            onClick={() => onChange?.(m.id)}
            title={m.hint}
          >
            {active && (
              <motion.span
                className="cc-mode-glow"
                layoutId="cc-mode-glow"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <Icon size={13} className="cc-mode-icon" />
            <span className="cc-mode-label">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
