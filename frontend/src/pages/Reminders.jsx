import { useState } from 'react'
import { useReminders, useCreateReminder, useUpdateReminder, useDeleteReminder, useSnoozeReminder, useDismissReminder } from '../hooks/useReminders'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import ConfirmModal from '../components/ui/ConfirmModal'
import toast from 'react-hot-toast'
import { Bell, Plus, Trash2, CheckCircle, Clock3, CircleOff } from 'lucide-react'

export default function Reminders() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [triggerAt, setTriggerAt] = useState('')
  const [recurrenceRule, setRecurrenceRule] = useState('')
  const [warnMinutes, setWarnMinutes] = useState('5')
  const [showForm, setShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const { data, isLoading, isError, refetch } = useReminders()
  const create = useCreateReminder()
  const update = useUpdateReminder()
  const del = useDeleteReminder()
  const snooze = useSnoozeReminder()
  const dismiss = useDismissReminder()

  const reminders = Array.isArray(data) ? data : []
  const active = reminders.filter((r) => !r.is_read && !r.dismissed_at)
  const done = reminders.filter((r) => r.is_read || r.dismissed_at)

  const onCreate = async () => {
    if (!title) return
    await create.mutateAsync({
      title,
      message: message || null,
      trigger_at: triggerAt || null,
      recurrence_rule: recurrenceRule || null,
      warn_minutes_before: parseInt(warnMinutes, 10) || 5,
    })
    setTitle(''); setMessage(''); setTriggerAt(''); setRecurrenceRule(''); setWarnMinutes('5')
    setShowForm(false)
    toast.success('Reminder created')
  }

  const markRead = (id) => update.mutate({ id, is_read: true })
  const snoozeReminder = (id, minutes) => snooze.mutate({ id, minutes })
  const dismissReminder = (id) => dismiss.mutate(id)
  const deleteReminder = (id) => { setConfirmDeleteId(id) }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reminders"
        description="Stay on top of what matters with timed and recurring alerts."
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            <Plus size={16} /> {showForm ? 'Close' : 'New reminder'}
          </button>
        }
      />

      {showForm && (
        <div className="surface-elevated p-5 space-y-3 animate-fade-up">
          <input autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reminder title" onKeyDown={(e) => e.key === 'Enter' && onCreate()} />
          <textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message (optional)" rows={2} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input type="datetime-local" className="input" value={triggerAt} onChange={(e) => setTriggerAt(e.target.value)} />
              <select className="select" value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value)}>
                <option value="">No recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <div className="flex items-center gap-2">
                <input type="number" className="input" value={warnMinutes} onChange={(e) => setWarnMinutes(e.target.value)} min="0" max="1440" placeholder="Min before" />
                <span className="text-xs text-slate-400 whitespace-nowrap">min before</span>
              </div>
              <button onClick={onCreate} disabled={create.isPending} className="btn btn-primary">Add reminder</button>
            </div>
        </div>
      )}

      {isError ? (
        <ErrorState title="Could not load reminders" onRetry={refetch} />
      ) : isLoading ? (
        <LoadingState message="Loading reminders..." />
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No reminders yet"
          description="Create a reminder to get notified at the right time."
          action={<button onClick={() => setShowForm(true)} className="btn btn-primary text-sm">New reminder</button>}
        />
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">Active · {active.length}</h3>
              <div className="space-y-3">
                {active.map((r) => (
                  <ReminderCard key={r.id} reminder={r} onMarkRead={markRead} onDelete={deleteReminder} onSnooze={snoozeReminder} onDismiss={dismissReminder} />
                ))}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">Completed · {done.length}</h3>
              <div className="space-y-3 opacity-75">
                {done.map((r) => (
                  <ReminderCard key={r.id} reminder={r} onMarkRead={markRead} onDelete={deleteReminder} onSnooze={snoozeReminder} onDismiss={dismissReminder} muted />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete this reminder?"
        description="This will permanently remove the reminder. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId) del.mutate(confirmDeleteId); setConfirmDeleteId(null) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}

function ReminderCard({ reminder: r, onMarkRead, onDelete, onSnooze, onDismiss, muted = false }) {
  return (
    <div className={`surface surface-interactive p-4 flex items-start gap-4 group ${muted ? 'bg-slate-200/20' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.is_read || r.dismissed_at ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-600'}`}>
        <Bell size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold ${r.is_read || r.dismissed_at ? 'text-slate-500' : 'text-slate-900'}`}>{r.title}</div>
        {r.message ? <div className="text-sm text-slate-500 mt-0.5">{r.message}</div> : null}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {r.trigger_at ? <span className="text-xs text-slate-400">{new Date(r.trigger_at).toLocaleString()}</span> : null}
          {r.recurrence_rule ? <span className="badge badge-repeat">Repeating</span> : null}
          {r.warn_minutes_before ? <span className="badge badge-pending">Voice {r.warn_minutes_before}min before</span> : null}
          {r.snoozed_until ? <span className="badge badge-progress">Snoozed until {new Date(r.snoozed_until).toLocaleTimeString()}</span> : null}
          {r.dismissed_at ? <span className="badge badge-muted">Dismissed</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!r.dismissed_at ? (
          <>
            <button type="button" onClick={() => onSnooze(r.id, 10)} className="btn-icon hover:text-violet-600" aria-label="Snooze 10 minutes"><Clock3 size={16} /></button>
            <button type="button" onClick={() => onDismiss(r.id)} className="btn-icon hover:text-amber-600" aria-label="Dismiss"><CircleOff size={16} /></button>
          </>
        ) : null}
        {!r.is_read ? (
          <button type="button" onClick={() => onMarkRead(r.id)} className="btn-icon hover:text-emerald-600" aria-label="Mark read"><CheckCircle size={16} /></button>
        ) : null}
        <button type="button" onClick={() => onDelete(r.id)} className="btn-icon hover:text-rose-500" aria-label="Delete reminder"><Trash2 size={15} /></button>
      </div>
    </div>
  )
}
