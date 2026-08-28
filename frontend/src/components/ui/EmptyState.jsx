export default function EmptyState({ icon: Icon, title, description, action, bare = false }) {
  const wrapper = bare ? 'empty-state empty-state-bare' : 'surface empty-state animate-fade-up';
  return (
    <div className={wrapper}>
      {Icon ? (
        <div className="empty-state-icon">
          <Icon size={28} strokeWidth={1.5} />
        </div>
      ) : null}
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
