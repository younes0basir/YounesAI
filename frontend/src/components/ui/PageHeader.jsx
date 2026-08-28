export default function PageHeader({ title, description, action, children, kicker }) {
  return (
    <div className="page-header animate-fade-up">
      <div className="page-header-copy">
        {kicker !== null ? (
          <span className="page-header-kicker">{kicker || 'Overview'}</span>
        ) : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
  );
}
