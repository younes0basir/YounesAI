import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import { useEvents } from '../hooks/useEvents'
import { useReminders } from '../hooks/useReminders'
import { usePendingAlerts } from '../hooks/useAlerts'
import { Calendar, Bell, Sparkles } from 'lucide-react'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  usePendingAlerts()

  return (
    <div className="min-h-screen app-bg text-slate-800">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

      <div className="shell-layout">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-20 xl:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`sidebar-shell fixed xl:sticky top-14 z-20 xl:z-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'}`}>
          <div className="surface sidebar-surface h-full">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </aside>

        <main className="page-main flex-1 min-w-0">
          <div className="animate-fade-up h-full">
            <Outlet />
          </div>
        </main>

        <aside className="right-rail hidden 2xl:block h-[calc(100vh-56px)] sticky top-14 overflow-auto nice-scroll space-y-4">
          <RightSidebar />
        </aside>
      </div>
    </div>
  )
}

function RightSidebar() {
  const { data: events } = useEvents()
  const { data: reminders } = useReminders()
  const nav = useNavigate()

  const todayEvents = Array.isArray(events) ? events.filter((e) => {
    if (!e.starts_at) return false
    return new Date(e.starts_at).toDateString() === new Date().toDateString()
  }).slice(0, 5) : []

  const unread = Array.isArray(reminders) ? reminders.filter((r) => !r.is_read && !r.dismissed_at).slice(0, 5) : []

  return (
    <>
      <div className="surface rail-panel">
        <div className="rail-header">
          <h3>Today</h3>
          <div className="nav-icon bg-blue-50 text-blue-600"><Calendar size={14} /></div>
        </div>
        {todayEvents.length === 0 ? (
          <p className="rail-empty">No events scheduled</p>
        ) : todayEvents.map((e) => (
          <button key={e.id} type="button" onClick={() => nav('/events')} className="rail-item">
            <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: e.color || '#10b99a' }} />
            <span className="truncate flex-1">{e.title}</span>
            <span className="rail-time">{new Date(e.starts_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
          </button>
        ))}
      </div>

      <div className="surface rail-panel">
        <div className="rail-header">
          <h3>Active reminders</h3>
          <div className="nav-icon bg-amber-50 text-amber-600"><Bell size={14} /></div>
        </div>
        {unread.length === 0 ? (
          <p className="rail-empty">All clear for now</p>
        ) : unread.map((r) => (
          <button key={r.id} type="button" onClick={() => nav('/reminders')} className="rail-item">
            <Bell size={12} className="text-primary-500 shrink-0" />
            <span className="truncate">{r.title}</span>
          </button>
        ))}
        {reminders && Array.isArray(reminders) && reminders.length > 0 && (
          <button onClick={() => nav('/reminders')} className="rail-link">View all reminders</button>
        )}
      </div>

      <div className="surface rail-panel stat-panel">
        <div className="rail-header compact-header">
          <Sparkles size={14} className="text-primary-600" />
          <h3>At a glance</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="mini-stat new">
            <div className="mini-stat-value">{Array.isArray(events) ? events.length : 0}</div>
            <div className="mini-stat-label">Events</div>
          </div>
          <div className="mini-stat warning">
            <div className="mini-stat-value">{Array.isArray(reminders) ? reminders.length : 0}</div>
            <div className="mini-stat-label">Reminders</div>
          </div>
        </div>
      </div>
    </>
  )
}
