const TONE_CLASS = {
  success: 'badge-done',
  warning: 'badge-pending',
  danger: 'badge-urgent',
  info: 'badge-progress',
  ai: 'badge-repeat',
  muted: 'badge-muted',
};

export default function StatusBadge({ tone = 'muted', children }) {
  return <span className={`badge ${TONE_CLASS[tone] || TONE_CLASS.muted}`}>{children}</span>;
}
