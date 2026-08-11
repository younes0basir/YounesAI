import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications, useMarkNotificationRead } from '../hooks/useNotifications'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'

const typeBadge = {
  task_due: 'badge-progress',
  task_overdue: 'badge-urgent',
  reminder_warning: 'badge-pending',
  reminder_due: 'badge-pending',
  system: 'badge-muted',
}

export default function Notifications() {
  const { data, isLoading, isError, refetch } = useNotifications()
  const markRead = useMarkNotificationRead()
  const notifications = Array.isArray(data) ? data : []
  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
      />

      {isError ? (
        <ErrorState title="Could not load notifications" onRetry={refetch} />
      ) : isLoading ? (
        <LoadingState message="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Alerts for due tasks and reminders will appear here." />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const unread = !n.read_at
            return (
              <div key={n.id} className={`surface surface-interactive p-4 ${unread ? 'border-primary-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${unread ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Bell size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-slate-900">{n.title}</div>
                      <span className={`badge ${typeBadge[n.type] || 'badge-muted'}`}>{n.type?.replace('_', ' ')}</span>
                    </div>
                    {n.body ? <p className="text-sm text-slate-600 mt-1">{n.body}</p> : null}
                    <div className="text-xs text-slate-400 mt-2">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  {unread ? (
                    <button onClick={() => markRead.mutate({ id: n.id })} className="btn-icon hover:text-emerald-600" title="Mark as read">
                      <CheckCheck size={17} />
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
