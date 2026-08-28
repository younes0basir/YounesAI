const accents = {
  tasks: 'text-emerald-600 bg-emerald-50',
  reminders: 'text-amber-600 bg-amber-50',
  events: 'text-blue-600 bg-blue-50',
  default: 'text-primary-600 bg-primary-50',
};

export default function MetricCard({ title, value, delta, icon, onClick, accent = 'default' }) {
  const tone = accents[accent] || accents.default;
  const isPositive = typeof delta === 'string' ? !delta.includes('0 open') : delta > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`metric-card surface surface-interactive ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && <div className={`metric-icon ${tone}`}>{icon}</div>}
          <div>
            <div className="text-sm font-medium text-slate-500">{title}</div>
            <div className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
          </div>
        </div>
        {delta ? (
          <div className={`badge self-start ${isPositive ? 'badge-done' : 'badge-muted'}`}>
            {delta}
          </div>
        ) : null}
      </div>
    </button>
  );
}
