import { useState } from 'react'
import { useEvents, useCreateEvent, useDeleteEvent } from '../hooks/useEvents'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import ConfirmModal from '../components/ui/ConfirmModal'
import toast from 'react-hot-toast'
import { Calendar, Plus, Trash2 } from 'lucide-react'

const colors = ['#3b82f6', '#10b99a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Events() {
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [color, setColor] = useState(colors[0])
  const [showForm, setShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const { data, isLoading, isError, refetch } = useEvents()
  const create = useCreateEvent()
  const del = useDeleteEvent()

  const events = Array.isArray(data) ? data : []
  const upcoming = events.filter((e) => !e.ends_at || new Date(e.ends_at) > new Date()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  const past = events.filter((e) => e.ends_at && new Date(e.ends_at) <= new Date()).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))

  const onCreate = async () => {
    if (!title || !startsAt) return
    await create.mutateAsync({ title, starts_at: startsAt, ends_at: endsAt || null, color })
    setTitle(''); setStartsAt(''); setEndsAt('')
    setShowForm(false)
    toast.success('Event created')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Events"
        description="Plan your schedule with color-coded calendar events."
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            <Plus size={16} /> {showForm ? 'Close' : 'New event'}
          </button>
        }
      />

      {showForm && (
        <div className="surface-elevated p-5 space-y-3 animate-fade-up">
          <input autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" onKeyDown={(e) => e.key === 'Enter' && onCreate()} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Start</label>
              <input type="datetime-local" className="input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">End</label>
              <input type="datetime-local" className="input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500 mr-1">Color</span>
            {colors.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Select color ${c}`} className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-violet-500 ring-2 ring-offset-2 ring-violet-300' : 'border-white shadow-sm'}`} style={{ backgroundColor: c }} />
            ))}
            <button onClick={onCreate} disabled={create.isPending} className="btn btn-primary ml-auto">Add event</button>
          </div>
        </div>
      )}

      {isError ? (
        <ErrorState title="Could not load events" onRetry={refetch} />
      ) : isLoading ? (
        <LoadingState message="Loading events..." />
      ) : events.length === 0 ? (
        <EmptyState icon={Calendar} title="No events yet" description="Create your first event to fill the calendar." action={<button onClick={() => setShowForm(true)} className="btn btn-primary text-sm">New event</button>} />
      ) : (
        <>
          <div className="space-y-3">
            {upcoming.map((e) => <EventCard key={e.id} event={e} onDelete={(id) => setConfirmDeleteId(id)} />)}
          </div>
          {past.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">Past · {past.length}</h3>
              <div className="space-y-3 opacity-70">
                {past.map((e) => <EventCard key={e.id} event={e} onDelete={(id) => setConfirmDeleteId(id)} />)}
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete this event?"
        description="This will permanently remove the event. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId) del.mutate(confirmDeleteId); setConfirmDeleteId(null) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}

function EventCard({ event: e, onDelete }) {
  const startDate = e.starts_at ? new Date(e.starts_at) : null
  const endDate = e.ends_at ? new Date(e.ends_at) : null
  const isMultiDay = startDate && endDate && startDate.toDateString() !== endDate.toDateString()
  const eventColor = e.color || colors[0]

  return (
    <div className="surface surface-interactive p-4 flex items-start gap-4 group">
      <div className="flex flex-col items-center w-12 shrink-0 rounded-2xl bg-gradient-to-b from-violet-50 to-primary-50 border border-violet-100/60 py-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase">{startDate?.toLocaleString('en', { month: 'short' })}</span>
        <span className="text-xl font-bold text-slate-800 leading-none mt-0.5">{startDate?.getDate()}</span>
      </div>
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: eventColor }} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900">{e.title}</div>
        <div className="text-sm text-slate-500 mt-0.5">
          {startDate?.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
          {endDate && ` – ${isMultiDay ? `${endDate.toLocaleDateString()} ` : ''}${endDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`}
        </div>
        {e.location_text ? <div className="text-xs text-slate-400 mt-1">{e.location_text}</div> : null}
      </div>
      <button type="button" onClick={() => onDelete(e.id)} className="btn-icon hover:text-rose-500 shrink-0" aria-label="Delete event"><Trash2 size={15} /></button>
    </div>
  )
}
