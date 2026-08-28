import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { Bell, Search, Settings, Zap, LogOut, Menu, X, Server } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { BACKEND_MODES, useBackend } from '../stores/useBackend';

export default function Header({ onToggleSidebar, sidebarOpen }) {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const backendMode = useBackend((s) => s.mode);
  const setBackendMode = useBackend((s) => s.setMode);
  const { data: notifications } = useNotifications();
  const [query, setQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBackendMenu, setShowBackendMenu] = useState(false);
  const menuRef = useRef();
  const backendRef = useRef();

  const unread = Array.isArray(notifications) ? notifications.filter((n) => !n.read_at).length : 0;

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false);
      if (backendRef.current && !backendRef.current.contains(e.target)) setShowBackendMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = (e) => {
    e.preventDefault();
    if (query.trim()) nav(`/search?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
  };

  const doLogout = () => {
    logout();
    toast.success('Signed out');
    nav('/auth/login');
  };

  const switchBackend = (mode) => {
    if (mode === backendMode) {
      setShowBackendMenu(false);
      return;
    }
    logout();
    setBackendMode(mode);
    setShowBackendMenu(false);
    toast('Sign in again — each backend has its own session.', { duration: 4000 });
    nav('/auth/login');
  };

  return (
    <header className="glass-header sticky top-0 z-30">
      <div className="h-14 flex items-center justify-between px-4 lg:px-6 max-w-[1560px] mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="xl:hidden btn-icon"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="brand-mark" aria-label="Workspace brand">
            AI
          </div>
          <div className="hidden sm:block">
            <div className="brand-title">Personal AI Assistant</div>
            <div className="brand-subtitle">{user?.display_name || 'Your workspace'}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <form
            onSubmit={doSearch}
            className="glass-search hidden lg:flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition-all"
          >
            <Search size={15} className="text-slate-500 shrink-0" />
            <input
              className="bg-transparent outline-none w-52 placeholder:text-slate-500 text-slate-900"
              placeholder="Search tasks, files, places..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="hidden xl:inline text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5">
              ↵
            </kbd>
          </form>

          <button
            onClick={() => nav('/tasks')}
            className="btn-icon hidden sm:flex"
            aria-label="Quick tasks"
            title="Quick tasks"
          >
            <Zap size={18} strokeWidth={1.75} className="text-primary-500" />
          </button>

          <button
            onClick={() => nav('/notifications')}
            className="btn-icon relative"
            aria-label="Notifications"
          >
            <Bell size={18} strokeWidth={1.75} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <div className="relative" ref={backendRef}>
            <button
              onClick={() => setShowBackendMenu(!showBackendMenu)}
              className="btn-icon flex sm:hidden"
              aria-label="Switch backend"
              title={`Backend: ${BACKEND_MODES[backendMode].label}`}
            >
              <Server
                size={16}
                className={backendMode === 'local' ? 'text-emerald-500' : 'text-primary-500'}
              />
            </button>
            <button
              onClick={() => setShowBackendMenu(!showBackendMenu)}
              className="hidden sm:flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100/80 transition-colors"
              aria-label="Switch backend"
              title={`Backend: ${BACKEND_MODES[backendMode].label} (${BACKEND_MODES[backendMode].url})`}
            >
              <Server
                size={14}
                className={backendMode === 'local' ? 'text-emerald-500' : 'text-primary-500'}
              />
              <span>{BACKEND_MODES[backendMode].label}</span>
            </button>
            {showBackendMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 surface-elevated py-1.5 z-50 animate-fade-up rounded-xl">
                <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200/80">
                  API backend
                </div>
                {Object.entries(BACKEND_MODES).map(([key, m]) => (
                  <button
                    key={key}
                    onClick={() => switchBackend(key)}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-violet-50/70 hover:text-violet-800 rounded-lg transition-colors"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        key === 'local' ? 'bg-emerald-500' : 'bg-primary-500'
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800">{m.label}</span>
                      <span className="block text-[11px] text-slate-500 truncate">{m.url}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative ml-0.5" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="user-menu-button"
              aria-label="User menu"
            >
              <div className="user-avatar">
                {(user?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:block user-menu-name">
                {user?.display_name || user?.email || 'You'}
              </span>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 surface-elevated py-1.5 z-50 animate-fade-up rounded-xl">
                <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200/80 truncate">
                  {user?.email}
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    nav('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-violet-50/70 hover:text-violet-800 rounded-lg transition-colors"
                >
                  <Settings size={15} /> Settings
                </button>
                <button
                  onClick={doLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '14px',
            borderRadius: '12px',
            background: '#ffffff',
            color: '#1c1c1f',
            border: '1px solid #e7e7ea',
            boxShadow: '0 8px 24px rgba(20, 20, 25, 0.12)',
          },
          success: { iconTheme: { primary: '#15803d', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#ffffff' } },
        }}
      />
    </header>
  );
}
