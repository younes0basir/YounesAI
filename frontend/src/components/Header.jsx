import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../stores/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { Bell, Search, Settings, Zap, LogOut, Menu, X } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function Header({ onToggleSidebar, sidebarOpen }) {
  const nav = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const { data: notifications } = useNotifications()
  const [query, setQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef()

  const unread = Array.isArray(notifications) ? notifications.filter((n) => !n.read_at).length : 0

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const doSearch = (e) => {
    e.preventDefault()
    if (query.trim()) nav(`/search?q=${encodeURIComponent(query.trim())}`)
    setQuery('')
  }

  const doLogout = () => {
    logout()
    toast.success('Signed out')
    nav('/auth/login')
  }

  return (
    <header className="glass-header sticky top-0 z-30">
      <div className="h-14 flex items-center justify-between px-4 lg:px-6 max-w-[1560px] mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={onToggleSidebar} className="xl:hidden btn-icon" aria-label="Toggle sidebar">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="brand-mark" aria-label="Workspace brand">AI</div>
          <div className="hidden sm:block">
            <div className="brand-title">Personal AI Assistant</div>
            <div className="brand-subtitle">{user?.display_name || 'Your workspace'}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <form onSubmit={doSearch} className="glass-search hidden lg:flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition-all">
            <Search size={15} className="text-slate-500 shrink-0" />
            <input className="bg-transparent outline-none w-52 placeholder:text-slate-500 text-slate-900" placeholder="Search tasks, files, places..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <kbd className="hidden xl:inline text-[10px] font-medium text-slate-600 bg-white/60 border border-slate-200 rounded px-1.5 py-0.5">↵</kbd>
          </form>

          <button onClick={() => nav('/tasks')} className="btn-icon hidden sm:flex" aria-label="Quick tasks" title="Quick tasks">
            <Zap size={18} strokeWidth={1.75} className="text-cyan-300" />
          </button>

          <button onClick={() => nav('/notifications')} className="btn-icon relative" aria-label="Notifications">
            <Bell size={18} strokeWidth={1.75} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-slate-950">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <div className="relative ml-0.5" ref={menuRef}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="user-menu-button" aria-label="User menu">
              <div className="user-avatar">
                {(user?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:block user-menu-name">{user?.display_name || user?.email || 'You'}</span>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 surface-elevated py-1.5 z-50 animate-fade-up">
                <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200/80 truncate">{user?.email}</div>
                <button onClick={() => { setShowUserMenu(false); nav('/settings') }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100/60"><Settings size={15} /> Settings</button>
                <button onClick={doLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50"><LogOut size={15} /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontSize: '14px', borderRadius: '12px', background: '#0f172a', color: '#e2e8f0' } }} />
    </header>
  )
}
