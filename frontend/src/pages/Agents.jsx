import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain, MapPin, FileText, Clock, Database, Activity, CheckCircle, Send, Loader,
  Network as NetworkIcon, Zap, HardDrive, Sparkles, BarChart3,
  ShieldCheck, HeartPulse, TrendingUp, DollarSign, LayoutGrid, Table,
  Megaphone, Image, HelpCircle, RefreshCw, MessageSquare, Terminal, Mail, Cpu,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgentSummary, useAgentBenchmark } from '../hooks/useAgents'
import api from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import ControlCenter from '../components/control-center/ControlCenter'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

const agentDefs = [
  { name: 'orchestrator', label: 'Orchestrator', icon: Brain, desc: 'Analyzes intent, routes & synthesizes responses', gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200', model: 'llama-3.3-70b-instruct', provider: 'NVIDIA', fallback: 'Groq → OpenRouter', color: '#8b5cf6' },
  { name: 'task', label: 'Task Agent', icon: CheckCircle, desc: 'Create, update, delete & list tasks', gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', model: 'llama-3.1-8b-instruct', provider: 'NVIDIA', fallback: 'Groq → OpenRouter', color: '#10b981' },
  { name: 'event', label: 'Event Agent', icon: Clock, desc: 'Calendar events & scheduling', gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', model: 'llama-3.1-8b-instruct', provider: 'NVIDIA', fallback: 'Groq → OpenRouter', color: '#3b82f6' },
  { name: 'place', label: 'Place Agent', icon: MapPin, desc: 'Addresses, locations & coordinates', gradient: 'from-rose-500 to-pink-600', bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', model: 'llama-3.1-8b-instruct', provider: 'NVIDIA', fallback: 'Groq → OpenRouter', color: '#f43f5e' },
  { name: 'file', label: 'File Agent', icon: FileText, desc: 'Document analysis & file operations', gradient: 'from-slate-600 to-slate-800', bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-300', model: 'llama-3.1-70b-instruct', provider: 'NVIDIA', fallback: 'OpenRouter', color: '#475569' },
  { name: 'memory', label: 'Memory Agent', icon: Database, desc: 'Semantic search & persistent storage', gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', model: 'bge-large-en-v1.5', provider: 'NVIDIA', fallback: 'OpenRouter', color: '#f59e0b' },
  { name: 'general', label: 'General Agent', icon: HelpCircle, desc: 'General conversation, greetings, fallback chat, and everyday Q&A', gradient: 'from-gray-500 to-slate-700', bg: 'bg-gray-100', text: 'text-slate-700', ring: 'ring-slate-200', model: 'llama-3.1-8b-instruct', provider: 'NVIDIA', fallback: 'Groq → OpenRouter', color: '#64748b' },
  { name: 'desktop', label: 'Desktop Agent', icon: HardDrive, desc: 'Local folder scanning, file discovery, desktop indexing and native file ops', gradient: 'from-cyan-500 to-sky-600', bg: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200', model: 'llama-3.1-8b-instruct', provider: 'NVIDIA', fallback: 'Groq → OpenRouter', color: '#06b6d4' },
  { name: 'image', label: 'Image Agent', icon: Image, desc: 'Text-to-image generation via NVIDIA FLUX.2 Klein', gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-50', text: 'text-pink-700', ring: 'ring-pink-200', model: 'FLUX.2-klein-4B', provider: 'NVIDIA', fallback: '—', color: '#ec4899' },
  { name: 'email', label: 'Email Agent', icon: Mail, desc: 'Gmail inbox classification, archiving, summarization, and task creation', gradient: 'from-indigo-500 to-violet-600', bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200', model: 'llama-3.1-8b-instruct', provider: 'NVIDIA', fallback: 'Groq → OpenRouter', color: '#6366f1' },
  { name: 'gemma', label: 'Gemma Agent', icon: Sparkles, desc: 'Advanced reasoning, synthesis and deeper fallback analysis', gradient: 'from-fuchsia-500 to-violet-600', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', ring: 'ring-fuchsia-200', model: 'gemma-4-31b-it', provider: 'OpenRouter', fallback: 'Groq', color: '#d946ef' },
]

const TIME_FILTERS = [
  { id: '24h', label: '24h' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'overall', label: 'All' },
]

const SANDBOX_EXAMPLES = [
  'Create a task for 21 this month named internship',
  'Create event for 15 this month named team sync',
  'Show my tasks',
  'What files are indexed?',
]

function TimeFilter({ value, onChange }) {
  return (
    <div className="agents-time-filter" role="group" aria-label="Time range">
      {TIME_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          className={value === filter.id ? 'active' : ''}
          onClick={() => onChange(filter.id)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}

function timeFilterLabel(timeFilter) {
  switch (timeFilter) {
    case '24h': return 'Last 24 hours'
    case 'week': return 'Last week'
    case 'month': return 'Last month'
    default: return 'All time'
  }
}

export default function Agents() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [timeFilter, setTimeFilter] = useState('24h')
  const [observabilityView, setObservabilityView] = useState('graph')
  const [benchmarkView, setBenchmarkView] = useState('graph')
  const [message, setMessage] = useState('')
  const [testResult, setTestResult] = useState(null)

  const timeFilterHours = useMemo(() => {
    switch (timeFilter) {
      case 'week': return 24 * 7
      case 'month': return 24 * 30
      case 'overall': return null
      default: return 24
    }
  }, [timeFilter])

  // Status and logs query
  const { data: statusData, isLoading: isStatusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['agent-status', timeFilterHours],
    queryFn: () => api.get('/agents/status', { params: timeFilterHours ? { hours: timeFilterHours } : {} }).then((r) => r.data),
    refetchInterval: 5000,
  })

  // Benchmark data
  const { data: benchmarkData, isLoading: benchmarkLoading } = useAgentBenchmark(timeFilterHours || 24)

  // Advanced Monitoring Queries
  const { data: indexData } = useQuery({
    queryKey: ['monitoring-index'],
    queryFn: () => api.get('/monitoring/document-index').then((r) => r.data),
    refetchInterval: 15000,
  })

  const { data: graphData } = useQuery({
    queryKey: ['monitoring-graph'],
    queryFn: () => api.get('/monitoring/knowledge-graph').then((r) => r.data),
    refetchInterval: 15000,
  })

  const { data: retrievalData } = useQuery({
    queryKey: ['monitoring-retrieval'],
    queryFn: () => api.get('/monitoring/retrieval-stats', { params: { hours: 24 } }).then((r) => r.data),
    refetchInterval: 15000,
  })

  const { data: evaluationSummary } = useQuery({
    queryKey: ['monitoring-evaluation'],
    queryFn: () => api.get('/evaluation/summary', { params: { hours: 24 } }).then((r) => r.data),
    refetchInterval: 15000,
  })

  const { data: summaryData } = useAgentSummary(timeFilterHours || 24)

  // System news feed
  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ['system-news'],
    queryFn: () => api.get('/news', { params: { limit: 10 } }).then((r) => r.data),
    refetchInterval: 60000,
  })

  const testChat = useMutation({
    mutationFn: (msg) => api.post('/agents/chat', { message: msg }).then((r) => r.data),
    onSuccess: (res) => setTestResult(res),
  })

  const status = statusData?.status
  const metrics = statusData?.metrics || []
  const recentCalls = metrics.slice(0, 15)

  // Computed metrics
  const successRate = useMemo(() => {
    if (metrics.length === 0) return 100
    const ok = metrics.filter((m) => m.success).length
    return Math.round((ok / metrics.length) * 100)
  }, [metrics])

  const avgLatency = useMemo(() => {
    if (metrics.length === 0) return 0
    const valid = metrics.filter((m) => m.latency_ms)
    if (valid.length === 0) return 0
    return Math.round(valid.reduce((a, b) => a + b.latency_ms, 0) / valid.length)
  }, [metrics])

  const handleRefresh = () => {
    refetchStatus()
    queryClient.invalidateQueries({ queryKey: ['agent-summary'] })
    queryClient.invalidateQueries({ queryKey: ['agent-benchmark'] })
  }

  const runSandbox = (text) => {
    const trimmed = text.trim()
    if (!trimmed || testChat.isPending) return
    setMessage(trimmed)
    testChat.mutate(trimmed)
  }

  const systemOnline = status?.orchestrator === 'active'

  const agentsLive = useMemo(
    () => agentDefs.filter((a) => (a.name === 'orchestrator' ? status?.orchestrator === 'active' : status?.agents?.includes(a.name))).length,
    [status]
  )

  return (
    <div className="space-y-5 pb-8 animate-fade-up">
      <PageHeader
        title="AI Control Center"
        description={`${agentsLive} of ${agentDefs.length} agents online · ${metrics.length} recent pipeline calls.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TimeFilter value={timeFilter} onChange={setTimeFilter} />
            <button type="button" onClick={handleRefresh} className="btn btn-secondary" aria-label="Refresh metrics">
              <RefreshCw size={15} className={isStatusLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button type="button" onClick={() => navigate('/chat')} className="btn btn-primary">
              <MessageSquare size={15} />
              Open chat
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className={`badge ${systemOnline ? 'badge-done' : 'badge-urgent'}`}>
            {systemOnline ? 'Orchestrator online' : 'Orchestrator offline'}
          </span>
          <span className="badge badge-muted">{timeFilterLabel(timeFilter)}</span>
          <span className="badge badge-muted">{metrics.length} recent calls</span>
        </div>
      </PageHeader>

      <div className="agents-stat-grid">
        {[
          {
            label: 'System health',
            value: metrics.length === 0 ? '—' : (successRate > 90 ? 'Healthy' : 'Degraded'),
            desc: metrics.length === 0 ? 'No pipeline calls in this window yet' : `${successRate}% of calls succeeded`,
            icon: HeartPulse,
            hint: 'Share of recent pipeline calls that completed without error.',
          },
          {
            label: 'Avg latency',
            value: metrics.length === 0 ? '—' : `${avgLatency}ms`,
            desc: 'Time for a call to finish',
            icon: Activity,
            hint: 'Average response time of recent pipeline calls.',
          },
          {
            label: 'Groundedness',
            value: evaluationSummary?.data?.avg_groundedness != null
              ? `${Math.round(evaluationSummary.data.avg_groundedness * 100)}%`
              : '—',
            desc: evaluationSummary?.data?.avg_groundedness != null ? 'Answers backed by your data' : 'No evaluation data yet',
            icon: ShieldCheck,
            hint: 'How often answers are supported by retrieved documents, not guessed.',
          },
          {
            label: 'Knowledge graph',
            value: `${graphData?.data?.nodes?.length || 0} nodes`,
            desc: `${graphData?.data?.totalEdges || 0} connections indexed`,
            icon: Database,
            hint: 'Entities and relationships extracted from your indexed files.',
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="agents-stat-card" title={stat.hint}>
              <div className="agents-stat-head">
                <span className="agents-stat-label">{stat.label}</span>
                <span className="agents-stat-icon"><Icon size={15} /></span>
              </div>
              <div className="agents-stat-value">{stat.value}</div>
              <div className="agents-stat-desc">{stat.desc}</div>
            </div>
          )
        })}
      </div>

      <div className="agents-tab-help">
        <HelpCircle size={14} className="shrink-0" />
        <p>
          An immersive, living view of the whole agent ecosystem. Hover a node for live status, click to zoom in,
          press <strong>Space</strong> for the command palette, and follow the AI pipeline at the bottom of the stage.
        </p>
      </div>

      <ControlCenter
        agents={agentDefs}
        status={status}
        metrics={metrics}
        onOpenWorkflow={() => navigate('/chat')}
        onOpenChat={() => navigate('/chat')}
      />

      {/* Deep-dive analytics below the living control center */}
      <WorkspacePanels
        activeTab="nodes"
        agentDefs={agentDefs}
        timeFilterLabel={timeFilterLabel(timeFilter)}
        summaryData={summaryData}
        benchmarkData={benchmarkData}
        benchmarkLoading={benchmarkLoading}
        observabilityView={observabilityView}
        setObservabilityView={setObservabilityView}
        benchmarkView={benchmarkView}
        setBenchmarkView={setBenchmarkView}
        indexData={indexData}
        graphData={graphData}
        retrievalData={retrievalData}
        recentCalls={recentCalls}
        message={message}
        setMessage={setMessage}
        testResult={testResult}
        setTestResult={setTestResult}
        runSandbox={runSandbox}
        testChat={testChat}
        newsData={newsData}
        newsLoading={newsLoading}
      />
    </div>
  )
}

/* ============================================================
   Deep-dive panels: agent roster, RAG, observability,
   benchmark, sandbox, news — kept below the living stage.
   ============================================================ */
function WorkspacePanels(props) {
  return (
    <div className="space-y-6">
      <AnalyticsSection {...props} />
      <BenchmarkSection {...props} />
      <SandboxSection {...props} />
      <NewsSection {...props} />
    </div>
  )
}

function AnalyticsSection({
  agentDefs, timeFilterLabel, summaryData, observabilityView, setObservabilityView,
  recentCalls, indexData, graphData, retrievalData,
}) {
  return (
    <section className="agents-panel-enter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 size={15} className="text-orange-500" /> Agent metrics · {timeFilterLabel}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setObservabilityView('graph')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${observabilityView === 'graph' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <LayoutGrid size={14} /> Graph
          </button>
          <button
            type="button"
            onClick={() => setObservabilityView('table')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${observabilityView === 'table' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <Table size={14} /> Table
          </button>
        </div>
      </div>

      {observabilityView === 'table' && (!summaryData?.summary || summaryData.summary.length === 0) && (
        <EmptyState
          icon={BarChart3}
          title="No metrics yet"
          description="Run a few chat requests or sandbox tests to populate agent observability."
        />
      )}
      {observabilityView === 'table' && summaryData?.summary && summaryData.summary.length > 0 && (
        <div className="surface p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-semibold rounded-l-lg">Agent Node</th>
                  <th className="px-4 py-3 font-semibold">API Provider</th>
                  <th className="px-4 py-3 font-semibold">Total Calls</th>
                  <th className="px-4 py-3 font-semibold">Success Rate</th>
                  <th className="px-4 py-3 font-semibold">Average Latency</th>
                  <th className="px-4 py-3 font-semibold rounded-r-lg">Tokens Ingested</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.summary.map((row, i) => {
                  const def = agentDefs.find((a) => a.name === row.agent_name)
                  const Icon = def?.icon || Cpu
                  return (
                    <tr key={i} className="border-b border-slate-100/60 last:border-0 hover:bg-slate-50/40">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${def?.bg || 'bg-slate-100'} ${def?.text || 'text-slate-500'}`}>
                          <Icon size={13} />
                        </span>
                        <span className="font-semibold text-slate-800">{def?.label || row.agent_name}</span>
                      </td>
                      <td className="px-4 py-3"><span className="badge badge-muted">{row.provider}</span></td>
                      <td className="px-4 py-3 font-bold text-slate-700">{row.total_calls}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-xs ${row.total_calls > 0 && (row.success_count / row.total_calls) > 0.8 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {row.total_calls > 0 ? Math.round((row.success_count / row.total_calls) * 100) : 0}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{row.avg_latency_ms || 0}ms</td>
                      <td className="px-4 py-3 font-bold text-indigo-600">{row.total_tokens?.toLocaleString() || 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {observabilityView === 'graph' && (!summaryData?.summary || summaryData.summary.length === 0) && (
        <EmptyState
          icon={LayoutGrid}
          title="No chart data yet"
          description="Agent performance charts appear after the pipeline handles real requests."
        />
      )}
      {observabilityView === 'graph' && summaryData?.summary && summaryData.summary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="surface p-5">
            <h4 className="font-bold text-slate-700 mb-4 text-sm">Total Calls by Agent</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summaryData.summary.map(r => ({
                name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                calls: r.total_calls,
              }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [value.toLocaleString(), 'Calls']}
                />
                <Bar dataKey="calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="surface p-5">
            <h4 className="font-bold text-slate-700 mb-4 text-sm">Success Rate by Agent</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summaryData.summary.map(r => ({
                name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                success: r.total_calls > 0 ? Math.round((r.success_count / r.total_calls) * 100) : 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`${value}%`, 'Success Rate']}
                />
                <Bar dataKey="success" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="surface p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Activity size={15} className="text-violet-500" /> Live Pipeline Activity
        </h3>
        {recentCalls.length === 0 ? (
          <EmptyState
            bare
            icon={Activity}
            title="No live activity"
            description="Recent agent calls will stream here as you use chat or the sandbox."
          />
        ) : (
          <div className="space-y-1">
            {recentCalls.map((m, i) => {
              const def = agentDefs.find((a) => a.name === m.agent_name)
              const Icon = def?.icon || Cpu
              const barW = Math.min(Math.round((m.latency_ms / 1000) * 100), 100)
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${def?.bg || 'bg-slate-100'}`}>
                    <Icon size={13} className={def?.text || 'text-slate-500'} />
                  </span>
                  <span className={`text-[13px] font-bold text-slate-800 w-20 shrink-0`}>{def?.label || m.agent_name}</span>
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barW}%`,
                          background: m.success ? `linear-gradient(90deg, ${def?.color || '#64748b'}, ${def?.color || '#64748b'}88)` : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 w-12 text-right shrink-0 font-semibold">{m.latency_ms}ms</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold ${m.success ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                    {m.success ? 'SUCCESS' : 'FAILURE'}
                  </span>
                  <span className="text-[11px] text-slate-400 w-16 text-right shrink-0 font-semibold">{m.provider || '-'}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* RAG trio */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="surface p-5 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-3 border-slate-100">
            <FileText size={16} className="text-slate-500" /> Document Index
          </h3>
          <p className="text-xs text-slate-500 -mt-2">Files that were scanned and split into searchable text chunks.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Unique Files</span>
              <div className="text-xl font-bold text-slate-700 mt-0.5">{indexData?.data?.stats?.unique_files || 0}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Chunks</span>
              <div className="text-xl font-bold text-slate-700 mt-0.5">{indexData?.data?.stats?.total_chunks || 0}</div>
            </div>
          </div>
        </div>
        <div className="surface p-5 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-3 border-slate-100">
            <NetworkIcon size={16} className="text-violet-500" /> Knowledge Graph
          </h3>
          <p className="text-xs text-slate-500 -mt-2">Entities and the connections between them, extracted from your files.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-violet-50/50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">Entity Nodes</span>
              <div className="text-xl font-bold text-violet-700 mt-0.5">{graphData?.data?.nodes?.length || 0}</div>
            </div>
            <div className="bg-violet-50/50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">Total Edges</span>
              <div className="text-xl font-bold text-violet-700 mt-0.5">{graphData?.data?.totalEdges || 0}</div>
            </div>
          </div>
        </div>
        <div className="surface p-5 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-3 border-slate-100">
            <Zap size={16} className="text-emerald-500" /> Retrieval
          </h3>
          <p className="text-xs text-slate-500 -mt-2">How often retrieval finds a useful document when you ask a question.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50/50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Queries</span>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">{retrievalData?.totals?.total || 0}</div>
            </div>
            <div className="bg-emerald-50/50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Avg response</span>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">{retrievalData?.totals?.avg_ms || 0}ms</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BenchmarkSection({ agentDefs, timeFilterLabel, benchmarkData, benchmarkLoading, benchmarkView, setBenchmarkView }) {
  return (
    <section className="agents-panel-enter">
      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={16} className="text-violet-500" /> Benchmark · {timeFilterLabel}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBenchmarkView('graph')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${benchmarkView === 'graph' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              <LayoutGrid size={14} /> Graph View
            </button>
            <button
              onClick={() => setBenchmarkView('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${benchmarkView === 'table' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              <Table size={14} /> Table View
            </button>
          </div>
        </div>

        <div className="agents-tab-help mb-5">
          <HelpCircle size={14} className="shrink-0" />
          <p>
            <strong className="text-slate-700">How to read this:</strong> higher success rate, groundedness, and speed are better;
            lower hallucination, error rate, and cost-per-call are better.
          </p>
        </div>

        {benchmarkLoading ? (
          <LoadingState message="Loading benchmark data…" />
        ) : !benchmarkData?.benchmark || benchmarkData.benchmark.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No benchmark data yet"
            description="Benchmarks populate after agents run with enough calls to analyze."
          />
        ) : benchmarkView === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-semibold rounded-l-lg">Agent</th>
                  <th className="px-4 py-3 font-semibold">Calls</th>
                  <th className="px-4 py-3 font-semibold">Success Rate</th>
                  <th className="px-4 py-3 font-semibold">Avg Latency</th>
                  <th className="px-4 py-3 font-semibold">Hallucination Rate</th>
                  <th className="px-4 py-3 font-semibold">Error Rate</th>
                  <th className="px-4 py-3 font-semibold">Groundedness</th>
                  <th className="px-4 py-3 font-semibold">Cost (USD)</th>
                  <th className="px-4 py-3 font-semibold rounded-r-lg">Cost/Call</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkData.benchmark.map((row, i) => {
                  const def = agentDefs.find((a) => a.name === row.agent_name)
                  const Icon = def?.icon || Cpu
                  return (
                    <tr key={i} className="border-b border-slate-100/60 last:border-0 hover:bg-slate-50/40">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${def?.bg || 'bg-slate-100'} ${def?.text || 'text-slate-500'}`}>
                          {Icon ? <Icon size={14} /> : <Cpu size={14} />}
                        </span>
                        <div>
                          <span className="font-semibold text-slate-800">{def?.label || row.agent_name}</span>
                          <div className="text-[10px] text-slate-400">{row.provider} · {row.model}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">{row.total_calls}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-xs ${row.success_rate >= 90 ? 'bg-emerald-50 text-emerald-700' : row.success_rate >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                          {row.success_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{row.avg_latency_ms}ms</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-xs ${row.hallucination_rate <= 5 ? 'bg-emerald-50 text-emerald-700' : row.hallucination_rate <= 15 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                          {row.hallucination_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-xs ${row.error_rate <= 5 ? 'bg-emerald-50 text-emerald-700' : row.error_rate <= 15 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                          {row.error_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-xs ${row.avg_groundedness >= 0.8 ? 'bg-emerald-50 text-emerald-700' : row.avg_groundedness >= 0.5 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                          {Math.round(row.avg_groundedness * 100)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">${row.estimated_cost_usd.toFixed(4)}</td>
                      <td className="px-4 py-3 font-medium text-slate-500">${row.cost_per_call.toFixed(6)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h4 className="font-bold text-slate-700 mb-4 text-sm">Success Rate & Latency by Agent</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={benchmarkData.benchmark.map(r => ({
                  name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                  success: r.success_rate,
                  latency: r.avg_latency_ms / 10,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value, name) => [name === 'success' ? `${value}%` : `${value * 10}ms`, name === 'success' ? 'Success Rate' : 'Latency']}
                  />
                  <Legend />
                  <Bar dataKey="success" name="Success Rate" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="latency" name="Latency (scaled)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h4 className="font-bold text-slate-700 mb-4 text-sm">Hallucination & Error Rates</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={benchmarkData.benchmark.map(r => ({
                  name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                  hallucination: r.hallucination_rate,
                  error: r.error_rate,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value) => [`${value}%`, '']}
                  />
                  <Legend />
                  <Bar dataKey="hallucination" name="Hallucination Rate" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="error" name="Error Rate" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {benchmarkData?.benchmark && benchmarkData.benchmark.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-4 text-sm">Overall Performance Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    cx="50%" cy="50%" outerRadius="70%"
                    data={[
                      { metric: 'Success Rate', value: benchmarkData.benchmark.reduce((sum, r) => sum + (r.success_rate || 0), 0) / benchmarkData.benchmark.length, fullMark: 100 },
                      { metric: 'Groundedness', value: benchmarkData.benchmark.reduce((sum, r) => sum + ((r.avg_groundedness || 0) * 100), 0) / benchmarkData.benchmark.length, fullMark: 100 },
                      { metric: 'Speed Score', value: benchmarkData.benchmark.reduce((sum, r) => sum + Math.max(0, 100 - ((r.avg_latency_ms || 0) / 10)), 0) / benchmarkData.benchmark.length, fullMark: 100 },
                      { metric: 'Reliability', value: benchmarkData.benchmark.reduce((sum, r) => sum + ((1 - (r.error_rate || 0)) * 100), 0) / benchmarkData.benchmark.length, fullMark: 100 },
                    ]}
                  >
                    <PolarGrid gridType="circle" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Radar name="Performance" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value) => [`${Number(value).toFixed(1)}%`, '']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {benchmarkData?.benchmark && benchmarkData.benchmark.length > 0 && (
          <div className="surface p-5 mt-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-500" /> Cost Analysis
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Total Cost</span>
                <div className="text-xl font-bold text-emerald-700 mt-1">${benchmarkData.benchmark.reduce((sum, r) => sum + r.estimated_cost_usd, 0).toFixed(4)}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Total Tokens</span>
                <div className="text-xl font-bold text-blue-700 mt-1">{benchmarkData.benchmark.reduce((sum, r) => sum + r.total_tokens, 0).toLocaleString()}</div>
              </div>
              <div className="bg-violet-50 rounded-xl p-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Avg Cost/Call</span>
                <div className="text-xl font-bold text-violet-700 mt-1">${(benchmarkData.benchmark.reduce((sum, r) => sum + r.estimated_cost_usd, 0) / benchmarkData.benchmark.reduce((sum, r) => sum + r.total_calls, 0)).toFixed(6)}</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Total Calls</span>
                <div className="text-xl font-bold text-amber-700 mt-1">{benchmarkData.benchmark.reduce((sum, r) => sum + r.total_calls, 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function SandboxSection({ message, setMessage, testResult, setTestResult, runSandbox, testChat }) {
  return (
    <section className="surface p-6 agents-panel-enter">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-100 text-primary-600">
              <Terminal size={15} />
            </span>
            <h2 className="font-semibold text-slate-800">Pipeline sandbox</h2>
          </div>
          <p className="text-sm text-slate-500 max-w-xl">
            Send a prompt through the full orchestrator pipeline and inspect which agents were invoked.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => { setMessage(''); setTestResult(null) }}>
          Clear
        </button>
      </div>

      <div className="sandbox-examples">
        <span className="text-xs font-semibold text-slate-400 self-center mr-1">Try:</span>
        {SANDBOX_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="sandbox-chip"
            onClick={() => runSandbox(example)}
            disabled={testChat.isPending}
          >
            {example}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); runSandbox(message) }} className="flex flex-col sm:flex-row gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder='e.g. "Create a task for 21 this month named internship"'
          className="input flex-1"
          aria-label="Sandbox prompt"
        />
        <button type="submit" disabled={testChat.isPending || !message.trim()} className="btn btn-primary shrink-0">
          {testChat.isPending ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
          Run pipeline
        </button>
      </form>

      {testChat.isError && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Request failed. Check that the backend is running and your session is valid.
        </div>
      )}

      {testResult && (
        <div className="mt-5 space-y-3">
          {(testResult.agents?.length || 0) > 0 && (
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-xs text-slate-500 font-semibold">Routed agents:</span>
              {testResult.agents.map((name) => {
                const def = agentDefs.find((a) => a.name === name)
                const Icon = def?.icon || Cpu
                return (
                  <span key={name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${def?.bg || 'bg-slate-100'} ${def?.text || 'text-slate-600'}`}>
                    <Icon size={12} /> {def?.label || name}
                  </span>
                )
              })}
            </div>
          )}
          <div className="sandbox-result">
            {testResult.response || testResult.message || 'No response'}
          </div>
        </div>
      )}
    </section>
  )
}

function NewsSection({ newsData, newsLoading }) {
  return (
    <section className="agents-panel-enter">
      <div className="surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-100 text-cyan-600">
            <Megaphone size={15} />
          </span>
          <h2 className="font-semibold text-slate-800">System news</h2>
        </div>

        {newsLoading ? (
          <LoadingState message="Loading news…" />
        ) : !newsData?.items || newsData.items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No updates yet"
            description="Platform changes and release notes will appear here."
          />
        ) : (
          <div className="space-y-3">
            {newsData.items.map((item) => {
              const categoryColors = {
                feature: 'bg-violet-50 text-violet-700 border-violet-200',
                fix: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                security: 'bg-rose-50 text-rose-700 border-rose-200',
                architecture: 'bg-amber-50 text-amber-700 border-amber-200',
              }
              const badgeClass = categoryColors[item.category] || 'bg-slate-50 text-slate-700 border-slate-200'
              return (
                <div key={item.id} className="surface p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badgeClass}`}>
                        {item.category}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{item.date}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">{item.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.body}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}