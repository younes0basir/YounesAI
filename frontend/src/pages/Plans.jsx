import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  MessageSquare,
  Mic,
  Image as ImageIcon,
  Mail,
  Zap,
  Check,
  Lock,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { usePlans } from '../hooks/useAdmin';
import { useAuth } from '../stores/useAuth';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import toast from 'react-hot-toast';

const TIER_META = {
  starter: {
    label: 'Starter',
    color: '#64748b',
    gradient: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  pro: {
    label: 'Pro',
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  platinum: {
    label: 'Platinum',
    color: '#0e7490',
    gradient: 'linear-gradient(135deg,#cffafe,#a5f3fc)',
    badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
};

function TierCard({ plan, isCurrent, usage }) {
  const meta = TIER_META[plan.tier] || TIER_META.starter;
  const l = plan.limits;
  const features = [
    { icon: MessageSquare, label: 'AI chat', value: `${l.ai_chat_daily} / day` },
    {
      icon: Mic,
      label: 'Voice AI',
      value: l.voice_daily > 0 ? `${l.voice_daily} / day` : 'Blocked',
    },
    {
      icon: ImageIcon,
      label: 'Image generation',
      value: l.image_daily > 0 ? `${l.image_daily} / day` : 'Blocked',
    },
    { icon: Mail, label: 'Gmail accounts', value: String(l.gmail_accounts) },
    { icon: Zap, label: 'Rate limit', value: `${l.agent_rate_limit_per_min} req/min` },
    { icon: Crown, label: 'Premium agents', value: l.premium_agents ? 'Included' : 'Blocked' },
  ];

  const usageForTier =
    isCurrent && usage
      ? [
          { key: 'ai_chat', label: 'AI chat', icon: MessageSquare },
          { key: 'voice', label: 'Voice', icon: Mic },
          { key: 'image', label: 'Image', icon: ImageIcon },
        ]
      : [];

  return (
    <div
      className={`surface p-5 flex flex-col ${isCurrent ? 'ring-2 ring-violet-300 shadow-lg' : ''}`}
      style={{ borderTop: `3px solid ${meta.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: meta.color }}
            >
              {plan.tier[0].toUpperCase()}
            </span>
            <h3 className="text-base font-bold text-slate-900">{meta.label}</h3>
            {isCurrent && (
              <span className="badge bg-violet-600 text-white text-[10px]">Current</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {plan.tier === 'starter'
              ? 'Free forever'
              : plan.tier === 'pro'
                ? 'For power users'
                : 'For teams & heavy AI use'}
          </p>
        </div>
        <span className={`badge border text-[10px] ${meta.badge}`}>{plan.tier}</span>
      </div>

      {usageForTier.length > 0 && usage && (
        <div className="mt-4 space-y-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <BarChart3 size={13} /> Today's usage
          </div>
          {usageForTier.map(({ key, label, icon: Icon }) => {
            const u = usage[key];
            if (!u) return null;
            const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
            const isBlocked = u.limit === 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Icon size={12} /> {label}
                  </span>
                  <span
                    className={`font-semibold ${isBlocked ? 'text-slate-400' : pct >= 90 ? 'text-amber-600' : 'text-slate-700'}`}
                  >
                    {isBlocked ? '—' : `${u.used} / ${u.limit}`}
                  </span>
                </div>
                {!isBlocked && (
                  <div className="progress-track h-1.5">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : undefined,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-slate-400">Resets daily at 00:00 UTC</p>
        </div>
      )}

      <div className="mt-4 space-y-2 flex-1">
        {features.map(({ icon: Icon, label, value }) => {
          const blocked = value === 'Blocked';
          return (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <Icon size={13} className={blocked ? 'text-slate-400' : 'text-slate-500'} /> {label}
              </span>
              <span
                className={`text-xs font-semibold inline-flex items-center gap-1 ${blocked ? 'text-slate-400' : 'text-slate-800'}`}
              >
                {blocked ? (
                  <>
                    <Lock size={11} /> Blocked
                  </>
                ) : (
                  <>
                    <Check size={11} className="text-emerald-500" /> {value}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        {isCurrent ? (
          <div className="text-xs text-center py-2 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 font-medium">
            You're on {meta.label}
          </div>
        ) : (
          <div className="text-xs text-center py-2 rounded-lg bg-slate-50 text-slate-500 border border-slate-200">
            Contact admin to upgrade — manual assignment (MVP)
          </div>
        )}
      </div>
    </div>
  );
}

export default function Plans() {
  const nav = useNavigate();
  const authUser = useAuth((s) => s.user);
  const { data: plansData, isLoading, error } = usePlans();
  const [liveUser, setLiveUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMe = async () => {
    try {
      setRefreshing(true);
      const res = await api.get('/auth/me');
      setLiveUser(res.data);
      // keep store in sync
      const { user } = res.data ? { user: res.data } : { user: null };
      if (res.data?.id) {
        localStorage.setItem('user', JSON.stringify(res.data));
      }
    } catch {
      // fallback to store user
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const user = liveUser || authUser;
  const plans = plansData?.plans || [];
  const currentTier = (user?.plan_tier || 'starter').toLowerCase();
  const usage = user?.usage || null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans & usage"
        description="Compare Starter, Pro and Platinum. Backend enforces daily quotas — tap refresh to see live usage."
        kicker="Subscription"
        action={
          <div className="flex gap-2">
            <button onClick={fetchMe} disabled={refreshing} className="btn btn-secondary text-sm">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => nav('/settings')} className="btn btn-ghost text-sm">
              Settings
            </button>
          </div>
        }
      />

      {user && (
        <div className="surface p-4 flex flex-wrap items-center gap-3">
          <span
            className={`badge border ${TIER_META[currentTier]?.badge || 'bg-slate-100 text-slate-700'}`}
          >
            {currentTier}
          </span>
          <span className="text-sm text-slate-700">
            <b>{user.display_name || user.email}</b> · {user.email}
          </span>
          {usage && (
            <span className="text-xs text-slate-500 ml-auto">
              AI {usage.ai_chat?.used ?? 0}/{usage.ai_chat?.limit ?? 0} today · Voice{' '}
              {usage.voice?.used ?? 0}/{usage.voice?.limit ?? 0} · Image {usage.image?.used ?? 0}/
              {usage.image?.limit ?? 0}
            </span>
          )}
        </div>
      )}

      {isLoading && (
        <div className="surface p-8 text-center text-sm text-slate-500">Loading plans…</div>
      )}
      {error && (
        <div className="surface p-4 text-sm text-rose-600">
          Failed to load plans: {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <TierCard key={p.tier} plan={p} isCurrent={p.tier === currentTier} usage={usage} />
        ))}
      </div>

      <div className="surface p-4">
        <h3 className="text-sm font-semibold text-slate-800">How quotas work</h3>
        <ul className="mt-2 text-xs leading-relaxed text-slate-600 list-disc pl-4 space-y-1">
          <li>
            Daily counters reset at <b>00:00 UTC</b>. Quota exceeded returns{' '}
            <code>429 quota_exceeded</code>; blocked feature returns{' '}
            <code>403 feature_not_available</code>.
          </li>
          <li>
            Backend counts only <b>successful</b> AI responses to avoid charging failed requests.
          </li>
          <li>
            Admin assigns plans manually via <code>PATCH /api/admin/users/:id/plan</code> with{' '}
            <code>X-Admin-Key</code>. Billing integration (Stripe/RevenueCat) is future work —
            schema stays unchanged.
          </li>
          <li>
            Need an upgrade? Contact your admin or use the Admin dashboard if you have the key.
          </li>
        </ul>
      </div>
    </div>
  );
}
