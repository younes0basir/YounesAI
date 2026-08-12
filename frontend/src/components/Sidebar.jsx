import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, CheckSquare, Calendar, MapPin, File, FolderKanban,
  MessageSquare, Mic, Sparkles, Bot, Bell, Settings as SettingsIcon, Inbox as InboxIcon,
} from 'lucide-react'
import { useAgentStatus } from '../hooks/useAgents'
import { useNotifications } from '../hooks/useNotifications'
import { usePendingApprovals } from '../hooks/useEmail'

const personalItems = [
  { to: '/', end: true, label: 'Home', icon: Home, tone: 'bg-violet-50 text-violet-600' },
  { to: '/inbox', label: 'Inbox', icon: InboxIcon, tone: 'bg-indigo-50 text-indigo-600', approvalBadge: true },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, tone: 'bg-emerald-50 text-emerald-600' },
  { to: '/events', label: 'Calendar', icon: Calendar, tone: 'bg-blue-50 text-blue-600' },
  { to: '/files', label: 'Files', icon: File, tone: 'bg-slate-100 text-slate-600' },
  { to: '/projects', label: 'Projects', icon: FolderKanban, tone: 'bg-cyan-50 text-cyan-600' },
  { to: '/places', label: 'Places', icon: MapPin, tone: 'bg-rose-50 text-rose-600' },
]

const aiItems = [
  { to: '/chat', label: 'Assistant', icon: MessageSquare, tone: 'bg-violet-50 text-violet-600' },
  { to: '/voice', label: 'Voice', icon: Mic, tone: 'bg-pink-50 text-pink-600' },
  { to: '/image-generator', label: 'Image Studio', icon: Sparkles, tone: 'bg-cyan-50 text-cyan-600' },
  { to: '/reminders', label: 'Reminders', icon: Bell, tone: 'bg-amber-50 text-amber-600' },
]

const studioItems = [
  { to: '/agents', label: 'AI Studio', icon: Bot, tone: 'bg-indigo-50 text-indigo-600', status: true },
]

function NavItems({ items, statusMap, badgeMap, onNavigate }) {
  return items.map((it) => {
    const Icon = it.icon
    const badgeCount = badgeMap?.[it.to] || 0
    return (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.end}
        onClick={onNavigate}
        className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
      >
        <span className={`nav-icon ${it.tone}`}>
          <Icon size={16} strokeWidth={2} />
        </span>
        <span className="flex-1">{it.label}</span>
        {badgeCount > 0 && (
          <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
        {it.status && !badgeCount && (
          <span className={`w-2 h-2 rounded-full ${statusMap?.orchestrator ? 'bg-green-500' : 'bg-slate-300'} ring-2 ring-white shrink-0`} title="Orchestrator status" />
        )}
      </NavLink>
    )
  })
}

export default function Sidebar({ onNavigate }) {
  const nav = useNavigate()
  const { data: agentStatus } = useAgentStatus()
  const { data: notifications } = useNotifications()
  const { data: approvals } = usePendingApprovals()
  const orchestratorActive = agentStatus?.status?.orchestrator === 'active'
  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read_at).length : 0
  const approvalCount = Array.isArray(approvals) ? approvals.length : 0
  const personalBadgeMap = approvalCount > 0 ? { '/inbox': approvalCount } : {}

  return (
    <div className="h-full flex flex-col min-h-0 p-3.5">
      <div className="flex-1 overflow-y-auto nice-scroll min-h-0 space-y-5">
        <div>
          <div className="section-label">Personal</div>
          <nav className="flex flex-col gap-0.5">
            <NavItems items={personalItems} badgeMap={personalBadgeMap} onNavigate={onNavigate} />
          </nav>
        </div>

        <div>
          <div className="section-label">AI</div>
          <nav className="flex flex-col gap-0.5">
            <NavItems items={aiItems} onNavigate={onNavigate} />
          </nav>
        </div>

        <div>
          <div className="section-label">AI Studio</div>
          <nav className="flex flex-col gap-0.5">
            <NavItems items={studioItems} statusMap={{ orchestrator: orchestratorActive }} onNavigate={onNavigate} />
          </nav>
          <p className="px-2 mt-1 text-[11px] leading-snug text-slate-400">Agents, pipeline, RAG, metrics &amp; sandbox — developer view.</p>
        </div>
      </div>

      <div className="shrink-0 pt-3 border-t border-slate-200/70 space-y-1">
        <button onClick={() => { nav('/chat'); onNavigate?.() }} className="w-full flex items-center gap-2.5 nav-item text-slate-600">
          <Bot size={15} className="shrink-0" />
          <span className="flex-1 text-left">Ask AI anything…</span>
          <kbd className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5 shrink-0">/</kbd>
        </button>

        <NavLink to="/notifications" onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
          <span className="nav-icon bg-orange-50 text-orange-600"><Bell size={16} strokeWidth={2} /></span>
          <span className="flex-1">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </NavLink>

        <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
          <span className="nav-icon bg-slate-100 text-slate-600"><SettingsIcon size={16} strokeWidth={2} /></span>
          <span className="flex-1">Settings</span>
        </NavLink>
      </div>
    </div>
  )
}
