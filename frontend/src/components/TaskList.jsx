import { Star } from 'lucide-react';

const urgencyStyles = {
  1: 'badge-done',
  2: 'badge-done',
  3: 'badge-pending',
  4: 'badge-urgent',
  5: 'badge-urgent',
};

export default function TaskList({ tasks = [] }) {
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="surface-interactive flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/50 bg-white/70 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${t.status === 'done' ? 'bg-primary-500 border-primary-500' : 'border-slate-300'}`}
            >
              {t.status === 'done' ? <span className="text-[8px] text-white">✓</span> : null}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-slate-800 flex items-center gap-2">
                <span
                  className={`truncate ${t.status === 'done' ? 'line-through text-slate-400' : ''}`}
                >
                  {t.title}
                </span>
                {t.is_favorite ? (
                  <Star size={13} className="fill-amber-400 text-amber-400 shrink-0" />
                ) : null}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {t.description || t.details || t.status}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {t.urgency ? (
              <span className={`badge ${urgencyStyles[t.urgency] || 'badge-muted'}`}>
                U{t.urgency}
              </span>
            ) : null}
            {t.priority ? <span className="badge badge-priority">P{t.priority}</span> : null}
            {t.due_at ? (
              <span className="text-xs text-slate-400 hidden sm:inline">
                {new Date(t.due_at).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
