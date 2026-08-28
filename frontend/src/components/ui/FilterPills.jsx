export default function FilterPills({ items, value, onChange, variant = 'primary' }) {
  const activeClass = variant === 'accent' ? 'filter-pill-accent-active' : 'filter-pill-active';

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const key = typeof item === 'string' ? item : item.key;
        const label = typeof item === 'string' ? item : item.label;
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`filter-pill ${active ? activeClass : ''}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
