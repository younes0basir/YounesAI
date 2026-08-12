import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Coins, Zap, Activity, MousePointerClick, TrendingUp } from 'lucide-react'

const fmtTime = (t) =>
  new Date(t).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })

export default function AnalyticsView({ history, counters }) {
  const data = useMemo(() => history.map((h) => ({
    ...h,
    t: fmtTime(h.t),
    latency: h.latency,
    requests: h.requests,
    tokens: Math.round(h.tokens / 1000),
  })), [history])

  return (
    <div className="cc-an">
      <div className="cc-an-kpis">
        <Kpi icon={Zap} label="Total tokens" value={counters.tokens > 0 ? `${Math.round(counters.tokens).toLocaleString()}` : '—'} sub="in+out across providers" tone="violet" />
        <Kpi icon={Activity} label="Avg latency" value={counters.latency ? `${counters.latency}ms` : '—'} sub="p95 orchestration path" tone="cyan" />
        <Kpi icon={Coins} label="Estimated cost" value={counters.cost > 0 ? `$${counters.cost.toFixed(4)}` : '—'} sub="blended model pricing" tone="emerald" />
        <Kpi icon={MousePointerClick} label="Requests routed" value={String(counters.requests || 0)} sub="this session" tone="amber" />
      </div>

      <div className="cc-an-charts">
        <ChartCard title="Token consumption" icon={TrendingUp} tone="#8b5cf6" hint="rolling live input+output tokens (k)">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data} margin={{ left: -18, right: 8, top: 6 }}>
              <defs>
                <linearGradient id="ccAnTok" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(100,116,139,0.16)" />
              <XAxis dataKey="t" hide />
              <YAxis hide domain={[0, 'dataMax + 4']} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} labelStyle={{ color: '#64748b' }} />
              <Area type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={2} fill="url(#ccAnTok)" animationDuration={700} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Latency" icon={Activity} tone="#06b6d4" hint="end-to-end ms per tick">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data} margin={{ left: -18, right: 8, top: 6 }}>
              <defs>
                <linearGradient id="ccAnLat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(100,116,139,0.16)" />
              <XAxis dataKey="t" hide />
              <YAxis hide domain={[0, 'dataMax + 80']} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} labelStyle={{ color: '#64748b' }} />
              <Area type="monotone" dataKey="latency" stroke="#06b6d4" strokeWidth={2} fill="url(#ccAnLat)" animationDuration={700} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Active workers" icon={Activity} tone="#10b981" hint="agents with a job in flight">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data} margin={{ left: -18, right: 8, top: 6 }}>
              <defs>
                <linearGradient id="ccAnAct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(100,116,139,0.16)" />
              <XAxis dataKey="t" hide />
              <YAxis hide domain={[0, 'dataMax + 1']} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} labelStyle={{ color: '#64748b' }} />
              <Area type="monotone" dataKey="working" stroke="#10b981" strokeWidth={2} fill="url(#ccAnAct)" animationDuration={700} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className={`cc-kpi cc-kpi-${tone}`}>
      <span className="cc-kpi-icon"><Icon size={14} /></span>
      <div className="cc-kpi-body">
        <span className="cc-kpi-value">{value}</span>
        <span className="cc-kpi-label">{label}</span>
        <span className="cc-kpi-sub">{sub}</span>
      </div>
    </div>
  )
}

function ChartCard({ title, tone, hint, children }) {
  return (
    <div className="cc-chart-card">
      <div className="cc-chart-head">
        <span className="cc-chart-title">
          <span className="cc-chart-dot" style={{ background: tone }} />
          {title}
        </span>
        <span className="cc-chart-hint">{hint}</span>
      </div>
      {children}
    </div>
  )
}