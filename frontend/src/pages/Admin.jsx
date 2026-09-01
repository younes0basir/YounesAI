import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Shield,
  KeyRound,
  Search,
  RefreshCw,
  Crown,
  Users,
  BarChart3,
  MessageSquare,
  Mic,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import {
  getAdminKey,
  setAdminKey,
  useAdminStats,
  useAdminUsers,
  usePlans,
  useUpdateUserPlan,
} from '../hooks/useAdmin';
import { useAuth } from '../stores/useAuth';

const PAGE_SIZE = 25;

const TIER_BADGE = {
  starter: 'bg-slate-100 text-slate-700 border-slate-200',
  pro: 'bg-violet-100 text-violet-700 border-violet-200',
  platinum: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

function StatCard({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide uppercase text-slate-500">
          {label}
        </span>
        <span className={`nav-icon ${tone}`}>
          <Icon size={14} />
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function UsageBar({ used, limit }) {
  if (limit === 0) return <span className="text-xs text-slate-400">— blocked</span>;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  let color = '#8b5cf6';
  if (pct >= 100) color = '#dc2626';
  else if (pct >= 80) color = '#f59e0b';
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="progress-track flex-1 h-1.5">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span
        className={`text-xs font-semibold shrink-0 ${pct >= 100 ? 'text-rose-600' : 'text-slate-600'}`}
      >
        {used}/{limit}
      </span>
    </div>
  );
}

export default function Admin() {
  const nav = useNavigate();
  const currentUser = useAuth((s) => s.user);
  const isJwtAdmin = Boolean(currentUser?.is_admin);
  const [adminKeyInput, setAdminKeyInput] = useState(getAdminKey());
  const [showKey, setShowKey] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [editingId, setEditingId] = useState(null);

  const hasKey = Boolean(getAdminKey());
  const hasAdminAccess = hasKey || isJwtAdmin;
  const statsQuery = useAdminStats(hasAdminAccess);
  const usersQuery = useAdminUsers({ search, limit: PAGE_SIZE, offset }, hasAdminAccess);
  const plansQuery = usePlans();
  const updatePlan = useUpdateUserPlan();

  const total = usersQuery.data?.total ?? 0;
  const users = usersQuery.data?.users ?? [];
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tierCounts = statsQuery.data?.byTier || {};
  const todayUsage = statsQuery.data?.todayUsage || null;

  const handleSaveKey = () => {
    const trimmed = adminKeyInput.trim();
    if (!trimmed) {
      toast.error('Enter an admin key');
      return;
    }
    setAdminKey(trimmed);
    toast.success('Admin key saved locally');
    // force refetch by invalidating via state change — queries key off getAdminKey(); trigger via reload offset
    setOffset(0);
    // hack: trigger re-render
    window.location.reload();
  };

  const handleClearKey = () => {
    setAdminKey('');
    setAdminKeyInput('');
    toast('Admin key cleared');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setOffset(0);
  };

  const handlePlanChange = async (userId, plan_tier) => {
    setEditingId(userId);
    try {
      await updatePlan.mutateAsync({ userId, plan_tier });
      toast.success(`Plan updated to ${plan_tier}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to update plan';
      const status = err.response?.status;
      if (status === 401) toast.error('Invalid admin key (401)');
      else if (status === 503) toast.error('ADMIN_API_KEY not configured on server');
      else toast.error(msg);
    } finally {
      setEditingId(null);
    }
  };

  const plans = useMemo(() => plansQuery.data?.plans || [], [plansQuery.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin — Plans"
        description="Manual plan assignment (MVP). Set your ADMIN_API_KEY below, then search users and switch tiers. Backend is source of truth."
        kicker="Administration"
        action={
          <div className="flex gap-2">
            <button onClick={() => nav('/plans')} className="btn btn-secondary text-sm">
              <Crown size={14} /> View plans
            </button>
            <a href="/api/docs" target="_blank" rel="noreferrer" className="btn btn-ghost text-sm">
              <ExternalLink size={14} /> API docs
            </a>
          </div>
        }
      />

      {/* Admin key gate */}
      <div className="surface p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <KeyRound size={16} className="text-violet-600" /> Admin key
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Stored in <code>localStorage.admin_api_key</code> and sent as <code>X-Admin-Key</code>.
          Never committed to git. Matches <code>ADMIN_API_KEY</code> in backend <code>.env</code>.
        </p>
        {isJwtAdmin && (
          <div className="mt-3 flex gap-2 items-center text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <Shield size={14} className="shrink-0" />
            <span>
              Signed in as <b>{currentUser?.email}</b> — JWT admin access enabled. You don't need a
              key, but you can still use one for scripts.
            </span>
          </div>
        )}
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={adminKeyInput}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              placeholder="Paste ADMIN_API_KEY…"
              className="input pr-10"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-ghost p-1.5 rounded-lg"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={handleSaveKey} className="btn btn-primary text-sm shrink-0">
            Save key
          </button>
          <button onClick={handleClearKey} className="btn btn-ghost text-sm shrink-0">
            Clear
          </button>
        </div>
        {!hasAdminAccess && (
          <div className="mt-3 flex gap-2 items-start text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              No admin access — sign in as <b>vodbo2001@gmail.com</b> (is_admin) or paste the{' '}
              <code>ADMIN_API_KEY</code> from backend <code>.env</code> and save.
            </span>
          </div>
        )}
        {hasAdminAccess && statsQuery.isError && (
          <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            {statsQuery.error?.response?.status === 401 &&
              'Unauthorized — check ADMIN_API_KEY or sign in as an admin user.'}
            {statsQuery.error?.response?.status === 503 &&
              'Backend ADMIN_API_KEY not configured (503). Set it in backend/.env and restart.'}
            {!statsQuery.error?.response?.status &&
              (statsQuery.error?.message || 'Failed to load admin data')}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total users"
          value={statsQuery.isLoading ? '…' : (statsQuery.data?.totalUsers ?? '—')}
          sub={hasAdminAccess ? `as of ${statsQuery.data?.date || 'today'}` : 'no admin access'}
          icon={Users}
          tone="bg-violet-50 text-violet-600"
        />
        <StatCard
          label="Starter"
          value={tierCounts.starter ?? '—'}
          sub={`${tierCounts.pro ?? 0} Pro · ${tierCounts.platinum ?? 0} Platinum`}
          icon={Shield}
          tone="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="AI chats today"
          value={todayUsage ? todayUsage.ai_chat_total : '—'}
          sub={
            todayUsage
              ? `Voice ${todayUsage.voice_total} · Image ${todayUsage.image_total}`
              : 'UTC daily counters'
          }
          icon={MessageSquare}
          tone="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Plans"
          value={plans.length || 3}
          sub="Starter · Pro · Platinum"
          icon={Crown}
          tone="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Plan catalog mini */}
      {plans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {plans.map((p) => (
            <div key={p.tier} className="surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 capitalize">{p.label}</span>
                <span className={`badge border text-[10px] ${TIER_BADGE[p.tier] || ''}`}>
                  {p.tier}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                <span className="text-slate-500">AI chat</span>
                <span className="font-semibold text-slate-800 text-right">
                  {p.limits.ai_chat_daily}/day
                </span>
                <span className="text-slate-500">Voice</span>
                <span className="font-semibold text-slate-800 text-right">
                  {p.limits.voice_daily || '— blocked'}
                </span>
                <span className="text-slate-500">Image</span>
                <span className="font-semibold text-slate-800 text-right">
                  {p.limits.image_daily || '— blocked'}
                </span>
                <span className="text-slate-500">Gmail</span>
                <span className="font-semibold text-slate-800 text-right">
                  {p.limits.gmail_accounts}
                </span>
                <span className="text-slate-500">Rate</span>
                <span className="font-semibold text-slate-800 text-right">
                  {p.limits.agent_rate_limit_per_min}/min
                </span>
                <span className="text-slate-500">Premium agents</span>
                <span className="font-semibold text-slate-800 text-right">
                  {p.limits.premium_agents ? 'yes' : 'no'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div className="surface overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b border-slate-200/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users size={16} /> Users
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:max-w-sm sm:ml-auto">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search email or name…"
                className="input pl-8 py-2 text-sm"
              />
            </div>
            <button type="submit" className="btn btn-secondary text-sm">
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setOffset(0);
              }}
              className="btn btn-ghost text-sm"
            >
              Clear
            </button>
          </form>
          <button
            type="button"
            onClick={() => usersQuery.refetch()}
            disabled={!hasAdminAccess || usersQuery.isFetching}
            className="btn btn-ghost text-sm shrink-0"
          >
            <RefreshCw size={14} className={usersQuery.isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {!hasAdminAccess ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Sign in as <b>vodbo2001@gmail.com</b> or save your admin key above to list users.
          </div>
        ) : usersQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading users…</div>
        ) : usersQuery.isError ? (
          <div className="p-6 text-sm text-rose-600">
            Failed to load users:{' '}
            {usersQuery.error?.response?.data?.error || usersQuery.error?.message}
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No users found{search ? ` for "${search}"` : ''}.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-xs text-slate-500">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">User</th>
                    <th className="text-left font-semibold px-3 py-2.5">Plan</th>
                    <th className="text-left font-semibold px-3 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare size={12} /> AI chat
                      </span>
                    </th>
                    <th className="text-left font-semibold px-3 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <Mic size={12} /> Voice
                      </span>
                    </th>
                    <th className="text-left font-semibold px-3 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon size={12} /> Image
                      </span>
                    </th>
                    <th className="text-left font-semibold px-3 py-2.5">Created</th>
                    <th className="text-right font-semibold px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 truncate max-w-[16rem] flex items-center gap-1.5">
                          {u.email || '—'}{' '}
                          {u.is_admin && (
                            <span className="badge bg-violet-600 text-white text-[9px]">ADMIN</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[16rem]">
                          {u.display_name || '—'} ·{' '}
                          <span className="font-mono text-[11px]">{u.id.slice(0, 8)}…</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`badge border text-[11px] ${TIER_BADGE[u.plan_tier] || ''}`}
                        >
                          {u.plan_tier}
                        </span>
                        {u.plan_updated_at && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(u.plan_updated_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <UsageBar
                          used={u.usage?.ai_chat?.used ?? 0}
                          limit={u.usage?.ai_chat?.limit ?? 0}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <UsageBar
                          used={u.usage?.voice?.used ?? 0}
                          limit={u.usage?.voice?.limit ?? 0}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <UsageBar
                          used={u.usage?.image?.used ?? 0}
                          limit={u.usage?.image?.limit ?? 0}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {['starter', 'pro', 'platinum'].map((tier) => (
                            <button
                              key={tier}
                              type="button"
                              disabled={editingId === u.id || u.plan_tier === tier}
                              onClick={() => handlePlanChange(u.id, tier)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${u.plan_tier === tier ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300 hover:text-violet-700'}`}
                              title={u.plan_tier === tier ? 'Current plan' : `Switch to ${tier}`}
                            >
                              {editingId === u.id
                                ? '…'
                                : tier === 'starter'
                                  ? 'Starter'
                                  : tier === 'pro'
                                    ? 'Pro'
                                    : 'Platinum'}
                              {u.plan_tier === tier && <Check size={11} className="inline ml-1" />}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/60 text-xs text-slate-500">
              <span>
                {total} user{total !== 1 ? 's' : ''} · page {page} of {pageCount} · {PAGE_SIZE} per
                page {search ? `· filter: "${search}"` : ''}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={!canPrev}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  className="btn btn-secondary text-xs disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  disabled={!canNext}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  className="btn btn-secondary text-xs disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="surface p-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 size={13} /> Tip:
        </span>
        <span>
          Use{' '}
          <code>
            curl -H "X-Admin-Key: $ADMIN_API_KEY" -X PATCH -d '{'{'}plan_tier":"pro"{'}'}'
            /api/admin/users/:id/plan
          </code>{' '}
          for scripting. Table above is the web equivalent.
        </span>
      </div>
    </div>
  );
}
