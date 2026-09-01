import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../stores/useAuth';
import PageHeader from '../components/ui/PageHeader';
import {
  LogOut,
  Mail,
  User,
  Shield,
  Link2,
  Unlink,
  RefreshCw,
  Crown,
  BarChart3,
  MessageSquare,
  Mic,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useGmailAccounts,
  useGmailSyncStatus,
  useConnectGmail,
  useDisconnectGmail,
  useSyncGmail,
} from '../hooks/useEmail';

export default function Settings() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const { data: accounts, isLoading: accountsLoading } = useGmailAccounts();
  const { data: syncStatus } = useGmailSyncStatus();
  const connectGmail = useConnectGmail();
  const disconnectGmail = useDisconnectGmail();
  const syncGmail = useSyncGmail();

  useEffect(() => {
    const gmail = searchParams.get('gmail');
    const message = searchParams.get('message');
    if (gmail === 'connected') toast.success('Gmail connected successfully');
    else if (gmail === 'error')
      toast.error(message ? decodeURIComponent(message) : 'Gmail connection failed');
  }, [searchParams]);

  const doLogout = () => {
    logout();
    toast.success('Signed out');
    nav('/auth/login');
  };

  const accountList = Array.isArray(accounts) ? accounts : [];
  const statusList = Array.isArray(syncStatus) ? syncStatus : [];

  const planTier = (user?.plan_tier || 'starter').toLowerCase();
  const usage = user?.usage || null;
  const limits = user?.limits || null;
  const tierBadge =
    planTier === 'platinum'
      ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
      : planTier === 'pro'
        ? 'bg-violet-100 text-violet-700 border-violet-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your account and workspace preferences."
        kicker="Account"
      />

      <div className="surface p-5 max-w-xl space-y-6">
        <div className="section-block">
          <div className="section-block-head">
            <h2>Profile</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="nav-icon bg-violet-50 text-violet-600">
                <User size={16} />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {user?.display_name || 'Your account'}
                </div>
                <div className="text-xs text-slate-500">Display name</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="nav-icon bg-blue-50 text-blue-600">
                <Mail size={16} />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-800">{user?.email || '—'}</div>
                <div className="text-xs text-slate-500">Account email</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-block">
          <div className="section-block-head">
            <h2>Subscription</h2>
            <p>Your current plan and daily AI usage.</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`badge border text-xs ${tierBadge}`}>
                <Crown size={11} /> {planTier}
              </span>
              <span className="text-xs text-slate-500">Plan tier (managed by admin)</span>
              <button onClick={() => nav('/plans')} className="ml-auto btn btn-secondary text-xs">
                View plans
              </button>
            </div>
            {usage ? (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'ai_chat', label: 'AI chat', icon: MessageSquare },
                  { key: 'voice', label: 'Voice', icon: Mic },
                  { key: 'image', label: 'Image', icon: ImageIcon },
                ].map(({ key, label, icon: Icon }) => {
                  const u = usage[key];
                  if (!u) return null;
                  const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
                  return (
                    <div
                      key={key}
                      className="rounded-xl bg-slate-50 border border-slate-200/60 p-2.5"
                    >
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <Icon size={11} /> {label}
                      </div>
                      <div className="text-sm font-bold text-slate-800 mt-1">
                        {u.limit === 0 ? 'Blocked' : `${u.used} / ${u.limit}`}
                      </div>
                      {u.limit > 0 && (
                        <div className="progress-track h-1.5 mt-1.5">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${pct}%`,
                              background:
                                pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : undefined,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Usage will appear here after you sign in.{' '}
                <button onClick={() => nav('/plans')} className="text-violet-600 underline">
                  See plans
                </button>
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => nav('/plans')} className="btn btn-ghost text-xs">
                <BarChart3 size={13} /> Plans & usage
              </button>
              <button onClick={() => nav('/admin')} className="btn btn-ghost text-xs">
                <Shield size={13} /> Admin dashboard
              </button>
            </div>
          </div>
        </div>

        <div className="section-block">
          <div className="section-block-head">
            <h2>Integrations</h2>
            <p>Connect up to 2 Gmail accounts for AI inbox classification.</p>
          </div>
          <div className="space-y-3">
            {accountsLoading && <p className="text-sm text-slate-500">Loading accounts…</p>}
            {accountList.map((acc) => {
              const st = statusList.find((s) => s.id === acc.id);
              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/60 border border-slate-200/60"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{acc.email_address}</div>
                    <div className="text-xs text-slate-500">
                      {st?.sync_status || acc.sync_status}
                      {st?.last_sync_at
                        ? ` · Last sync ${new Date(st.last_sync_at).toLocaleString()}`
                        : ''}
                    </div>
                    {st?.last_sync_error && (
                      <div className="text-xs text-rose-600 mt-1">{st.last_sync_error}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() =>
                        syncGmail.mutate(acc.id, {
                          onSuccess: () => toast.success('Sync complete'),
                          onError: (e) => toast.error(e.response?.data?.error || 'Sync failed'),
                        })
                      }
                      disabled={syncGmail.isPending}
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs text-rose-600"
                      onClick={() =>
                        disconnectGmail.mutate(acc.id, {
                          onSuccess: () => toast.success('Disconnected'),
                        })
                      }
                    >
                      <Unlink size={14} /> Disconnect
                    </button>
                  </div>
                </div>
              );
            })}
            {accountList.length < 2 && (
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={() =>
                  connectGmail.mutate(undefined, {
                    onError: (e) => toast.error(e.response?.data?.error || 'Could not start OAuth'),
                  })
                }
                disabled={connectGmail.isPending}
              >
                <Link2 size={15} /> Connect Gmail
              </button>
            )}
          </div>
        </div>

        <div className="section-block">
          <div className="section-block-head">
            <h2>Session</h2>
            <p>Sign out of this device.</p>
          </div>
          <button onClick={doLogout} className="btn btn-secondary text-sm text-rose-600">
            <LogOut size={15} /> Sign out
          </button>
        </div>

        <div className="section-block">
          <div className="section-block-head">
            <h2>About</h2>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="nav-icon bg-slate-100 text-slate-600">
              <Shield size={16} />
            </span>
            <span>Personal AI Assistant · v2.0 · Multi-agent system</span>
          </div>
        </div>
      </div>
    </div>
  );
}
