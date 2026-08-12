import TaskList from '../components/TaskList'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import AIStateCard from '../components/ui/AIStateCard'
import { useTasks } from '../hooks/useTasks'
import { useTaskStats, useRecentActivity } from '../hooks/useDashboard'
import { useEvents } from '../hooks/useEvents'
import { useNotifications } from '../hooks/useNotifications'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { CheckSquare, Calendar, Bell, Sparkles, Plus, ArrowRight, MessageSquare } from 'lucide-react'
import { useAuth } from '../stores/useAuth'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatPill({ icon: Icon, value, label, onClick, tone }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border border-slate-200/60 bg-white/70 hover:bg-white hover:border-violet-200 hover:shadow-md backdrop-blur-sm transition-all text-left">
      <span className={`nav-icon ${tone}`}><Icon size={16} /></span>
      <span>
        <span className="block text-base font-bold text-slate-900 leading-none">{value}</span>
        <span className="block text-[11px] text-slate-500 mt-0.5">{label}</span>
      </span>
    </button>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const user = useAuth((s) => s.user)
  const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useTasks()
  const { data: stats } = useTaskStats()
  const { data: activity, isLoading: activityLoading, isError: activityError, refetch: refetchActivity } = useRecentActivity()
  const { data: events, isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useEvents()
  const { data: notifications } = useNotifications()

  const recentTasks = Array.isArray(tasks) ? tasks.filter((t) => t.status !== 'done').slice(0, 5) : []
  const unreadNotifications = Array.isArray(notifications) ? notifications.filter((n) => !n.read_at).length : 0

  const todayEvents = Array.isArray(events) ? events.filter((e) => {
    if (!e.starts_at) return false
    return new Date(e.starts_at).toDateString() === new Date().toDateString()
  }).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)) : []

  const firstName = (user?.display_name || '').split(' ')[0] || 'there'

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900" style={{ letterSpacing: '-0.03em' }}>
            {greeting()}, {firstName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{format(new Date(), 'EEEE, MMMM do')} · here's what's happening today.</p>
        </div>
        <button onClick={() => nav('/chat')} className="btn btn-primary shrink-0">
          <MessageSquare size={16} /> Ask your assistant
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-fade-up">
        <StatPill icon={CheckSquare} value={stats?.open ?? '—'} label="Open tasks" tone="bg-emerald-50 text-emerald-600" onClick={() => nav('/tasks')} />
        <StatPill icon={Calendar} value={todayEvents.length} label="Events today" tone="bg-blue-50 text-blue-600" onClick={() => nav('/events')} />
        <StatPill icon={Bell} value={unreadNotifications} label="Notifications" tone="bg-orange-50 text-orange-600" onClick={() => nav('/notifications')} />
        <StatPill icon={Sparkles} value={Array.isArray(activity) ? activity.length : 0} label="AI actions" tone="bg-violet-50 text-violet-600" onClick={() => nav('/agents')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          <section className="section-block">
            <div className="section-block-head">
              <div>
                <h2>Tasks</h2>
                <p>What still needs your attention.</p>
              </div>
              <button onClick={() => nav('/tasks')} className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 shrink-0">
                View all <ArrowRight size={12} />
              </button>
            </div>
            {tasksError ? (
              <ErrorState bare title="Could not load tasks" onRetry={refetchTasks} />
            ) : tasksLoading ? (
              <LoadingState message="Loading tasks..." />
            ) : recentTasks.length === 0 ? (
              <EmptyState
                bare
                icon={CheckSquare}
                title="Nothing pending"
                description="You're all caught up. Create a task to get started."
                action={<button onClick={() => nav('/tasks')} className="btn btn-secondary text-sm"><Plus size={14} /> New task</button>}
              />
            ) : (
              <TaskList tasks={recentTasks} />
            )}
          </section>

          <section className="section-block">
            <div className="section-block-head">
              <div>
                <h2>Today</h2>
                <p>Your schedule for {format(new Date(), 'MMMM do')}.</p>
              </div>
              <button onClick={() => nav('/events')} className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 shrink-0">
                View all <ArrowRight size={12} />
              </button>
            </div>
            {eventsError ? (
              <ErrorState bare title="Could not load events" onRetry={refetchEvents} />
            ) : eventsLoading ? (
              <LoadingState message="Loading events..." />
            ) : todayEvents.length === 0 ? (
              <EmptyState
                bare
                icon={Calendar}
                title="Nothing scheduled today"
                description="Your calendar is clear."
                action={<button onClick={() => nav('/events')} className="btn btn-secondary text-sm"><Plus size={14} /> Add event</button>}
              />
            ) : (
              <div className="space-y-2">
                {todayEvents.map((e) => (
                  <button key={e.id} type="button" onClick={() => nav('/events')} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200/50 hover:border-violet-200 hover:bg-violet-50/40 bg-white/60 backdrop-blur-sm transition-all text-left">
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: e.color || '#10b99a' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{e.title}</div>
                      <div className="text-xs text-slate-400">{new Date(e.starts_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="section-block">
          <div className="section-block-head">
            <div>
              <h2>AI activity</h2>
              <p>What your assistant has been doing.</p>
            </div>
          </div>
          {activityError ? (
            <ErrorState bare title="Could not load activity" onRetry={refetchActivity} />
          ) : activityLoading ? (
            <LoadingState message="Loading activity..." />
          ) : !activity || activity.length === 0 ? (
            <EmptyState
              bare
              icon={Sparkles}
              title="No AI activity yet"
              description="Actions your assistant takes will show up here."
            />
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <AIStateCard
                  key={a.id}
                  state={a.status === 'failed' ? 'failed' : 'completed'}
                  message={a.title}
                  meta={a.time}
                />
              ))}
            </div>
          )}
          <button onClick={() => nav('/agents')} className="rail-link mt-1">Open AI Studio for full history</button>
        </section>
      </div>
    </div>
  )
}
