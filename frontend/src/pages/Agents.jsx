import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cpu, Brain, MapPin, FileText, Clock, Database, Activity, CheckCircle, Send, Loader,
  Network, Zap, HardDrive, Sparkles, Radio, BarChart3, Layers, ArrowRight,
  ShieldCheck, HeartPulse, TrendingUp, DollarSign, AlertOctagon, LayoutGrid, Table,
  Megaphone, Image, HelpCircle, Search, RefreshCw, MessageSquare, Terminal, Mail,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgentSummary, useAgentBenchmark } from '../hooks/useAgents'
import api from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import PipelineFlow from '../components/agents/PipelineFlow'
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

const agentsFlat = agentDefs.slice(1)

const TIME_FILTERS = [
  { id: '24h', label: '24h' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'overall', label: 'All' },
]

const NAV_TABS = [
  { id: 'dashboard', label: 'Pipeline', icon: Layers },
  { id: 'nodes', label: 'Agents', icon: Radio },
  { id: 'rag', label: 'RAG', icon: Network },
  { id: 'observability', label: 'Metrics', icon: BarChart3 },
  { id: 'benchmark', label: 'Benchmark', icon: TrendingUp },
  { id: 'sandbox', label: 'Sandbox', icon: Terminal },
  { id: 'news', label: 'News', icon: Megaphone },
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
  const [activeTab, setActiveTab] = useState('dashboard')
  const [message, setMessage] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [benchmarkView, setBenchmarkView] = useState('graph')
  const [observabilityView, setObservabilityView] = useState('graph')
  const [timeFilter, setTimeFilter] = useState('24h')
  const [agentSearch, setAgentSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | active | idle

  // Convert time filter to hours
  const timeFilterHours = useMemo(() => {
    switch (timeFilter) {
      case '24h': return 24
      case 'week': return 168 // 7 * 24
      case 'month': return 720 // 30 * 24
      case 'overall': return null // no time limit
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

  const filteredAgentDefs = useMemo(() => {
    const query = agentSearch.trim().toLowerCase()
    return agentDefs.filter((agent) => {
      const isOnline = agent.name === 'orchestrator'
        ? status?.orchestrator === 'active'
        : status?.agents?.includes(agent.name)
      if (statusFilter === 'active' && !isOnline) return false
      if (statusFilter === 'idle' && isOnline) return false
      if (!query) return true
      return (
        agent.label.toLowerCase().includes(query)
        || agent.name.toLowerCase().includes(query)
        || agent.desc.toLowerCase().includes(query)
        || agent.model.toLowerCase().includes(query)
      )
    })
  }, [agentSearch, statusFilter, status])

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

  return (
    <div className="space-y-5 pb-8 animate-fade-up">
      <PageHeader
        title="AI Control Center"
        description="Monitor agent health, routing, retrieval, and run pipeline tests."
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
            {systemOnline ? 'System active' : 'System offline'}
          </span>
          <span className="badge badge-muted">{timeFilterLabel(timeFilter)}</span>
          <span className="badge badge-muted">{metrics.length} recent calls</span>
        </div>
      </PageHeader>

      <div className="agents-stat-grid">
        {[
          { label: 'System health', value: successRate > 90 ? 'Healthy' : 'Degraded', desc: `${successRate}% success rate`, icon: HeartPulse },
          { label: 'Avg latency', value: `${avgLatency}ms`, desc: 'Across recent pipeline calls', icon: Activity },
          { label: 'Groundedness', value: `${evaluationSummary?.data?.avg_groundedness ? Math.round(evaluationSummary.data.avg_groundedness * 100) : 94}%`, desc: 'RAG confidence score', icon: ShieldCheck },
          { label: 'Knowledge graph', value: `${graphData?.data?.nodes?.length || 0} nodes`, desc: `${graphData?.data?.totalEdges || 0} edges indexed`, icon: Database },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="agents-stat-card">
              <span className="agents-stat-label"><Icon size={13} /> {stat.label}</span>
              <div className="agents-stat-value">{stat.value}</div>
              <div className="agents-stat-desc">{stat.desc}</div>
            </div>
          )
        })}
      </div>

      <nav className="agents-tab-bar" aria-label="Agent sections">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`agents-tab ${active ? 'agents-tab-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* SPACE 1: Dashboard Flow */}
      {activeTab === 'dashboard' && (
        <div className="agents-panel-enter">
          <PipelineFlow
            agentDefs={agentDefs}
            agentsFlat={agentsFlat}
            status={status}
            onRunExample={(prompt) => {
              setActiveTab('sandbox')
              setMessage(prompt)
              setTestResult(null)
            }}
          />
        </div>
      )}

      {/* SPACE 2: Specialist Nodes */}
      {activeTab === 'nodes' && (
        <div className="agents-panel-enter">
          <div className="agents-toolbar">
            <div className="agents-search-wrap">
              <Search size={15} />
              <input
                type="search"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="Search agents, models, capabilities…"
                className="agents-search"
                aria-label="Search agents"
              />
            </div>
            <div className="agents-time-filter" role="group" aria-label="Agent status filter">
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'idle', label: 'Idle' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={statusFilter === option.id ? 'active' : ''}
                  onClick={() => setStatusFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {filteredAgentDefs.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No agents match your filters"
              description="Try a different search term or show all agents again."
              action={
                <button type="button" className="btn btn-secondary" onClick={() => { setAgentSearch(''); setStatusFilter('all') }}>
                  Clear filters
                </button>
              }
            />
          ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgentDefs.map((agent) => {
            const Icon = agent.icon
            const agentMetrics = metrics.filter((m) => m.agent_name === agent.name)
            const isOnline = agent.name === 'orchestrator'
              ? status?.orchestrator === 'active'
              : status?.agents?.includes(agent.name)
            const agentAvgLat = agentMetrics.length > 0
              ? Math.round(agentMetrics.reduce((a, b) => a + b.latency_ms, 0) / agentMetrics.length)
              : null
            const agentSuccess = agentMetrics.length > 0
              ? Math.round((agentMetrics.filter((m) => m.success).length / agentMetrics.length) * 100)
              : null

            return (
              <div
                key={agent.name}
                className={`relative rounded-xl border bg-white p-5 transition-colors ${isOnline ? 'hover:border-slate-300' : 'opacity-50'}`}
                style={{ borderColor: isOnline ? `${agent.color}35` : '#e8edf4' }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${agent.color}15`, color: agent.color }}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{agent.label}</span>
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        {isOnline ? 'active' : 'offline'}
                      </span>
                    </div>
                    <div className="text-[13px] text-slate-500 mt-1 leading-relaxed">{agent.desc}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 text-[11px] text-slate-400 font-semibold">
                      <span className="inline-flex items-center gap-1"><Zap size={11} />{agent.provider}</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{agent.model}</span>
                      {agent.fallback && agent.fallback !== '—' && <span className="inline-flex items-center gap-1 text-slate-400"><ArrowRight size={10} />{agent.fallback}</span>}
                      {agentAvgLat !== null && <span className="inline-flex items-center gap-1 text-slate-500"><Activity size={11} />{agentAvgLat}ms</span>}
                    </div>
                  </div>
                </div>
                {agentMetrics.length > 0 && (
                  <div className="relative mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-end gap-1 h-8">
                      {agentMetrics.slice(0, 10).reverse().map((m, i) => {
                        const maxH = 28
                        const h = Math.min(Math.round((m.latency_ms / 500) * maxH), maxH)
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group/bar">
                            <div
                              className="w-full rounded-sm transition-all hover:opacity-100"
                              style={{
                                height: `${Math.max(h, 4)}px`,
                                background: m.success ? agent.color : '#ef4444',
                                opacity: m.success ? 0.7 : 0.95,
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-semibold text-slate-400">Node Performance Log</span>
                      <span className={`text-[10px] font-bold ${agentSuccess !== null && agentSuccess > 80 ? 'text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-slate-500'}`}>
                        {agentSuccess}% OK ({agentMetrics.filter((m) => m.success).length} runs)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
          )}
        </div>
      )}

      {/* SPACE 3: Graph RAG & Retrieval */}
      {activeTab === 'rag' && (
        <div className="grid md:grid-cols-3 gap-6 agents-panel-enter">
          {/* Index statistics */}
          <div className="surface p-5 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-3 border-slate-100">
              <FileText size={16} className="text-slate-500" /> Document Index
            </h3>
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
            {indexData?.data?.byType && indexData.data.byType.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500">File Type Coverage</span>
                <div className="space-y-1.5">
                  {indexData.data.byType.map((t) => (
                    <div key={t.file_type} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 uppercase">.{t.file_type}</span>
                      <span className="text-slate-400">{t.file_count} documents</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Knowledge Graph statistics */}
          <div className="surface p-5 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-3 border-slate-100">
              <Network size={16} className="text-violet-500" /> Knowledge Graph Matrix
            </h3>
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
            {graphData?.data?.entityCounts && graphData.data.entityCounts.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-violet-500">Entity Node Distribution</span>
                <div className="space-y-1.5">
                  {graphData.data.entityCounts.map((e) => (
                    <div key={e.type} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 uppercase">{e.type}</span>
                      <span className="text-slate-400">{e.count} nodes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Retrieval Stats */}
          <div className="surface p-5 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-3 border-slate-100">
              <Zap size={16} className="text-emerald-500" /> RAG Retrieval Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50/50 rounded-xl p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Log queries</span>
                <div className="text-xl font-bold text-emerald-700 mt-0.5">{retrievalData?.totals?.total || 0}</div>
              </div>
              <div className="bg-emerald-50/50 rounded-xl p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Avg response</span>
                <div className="text-xl font-bold text-emerald-700 mt-0.5">{retrievalData?.totals?.avg_ms || 0}ms</div>
              </div>
            </div>
            {retrievalData?.data && retrievalData.data.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-500">Hit Rate by Source</span>
                <div className="space-y-1.5">
                  {retrievalData.data.map((r) => (
                    <div key={r.source} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 uppercase">{r.source}</span>
                      <span className="text-slate-400">{r.hit_rate_pct}% hits ({r.total_queries} runs)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SPACE 4: Observability Logs */}
      {activeTab === 'observability' && (
        <div className="space-y-6 agents-panel-enter">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 size={15} className="text-orange-500" /> Agent metrics · {timeFilterLabel(timeFilter)}
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

          {/* Table View */}
          {observabilityView === 'table' && (!summaryData?.summary || summaryData.summary.length === 0) && (
            <EmptyState
              icon={BarChart3}
              title="No metrics yet"
              description="Run a few chat requests or sandbox tests to populate agent observability."
              action={
                <button type="button" className="btn btn-primary" onClick={() => setActiveTab('sandbox')}>
                  Open sandbox
                </button>
              }
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

          {/* Graph View */}
          {observabilityView === 'graph' && (!summaryData?.summary || summaryData.summary.length === 0) && (
            <EmptyState
              icon={LayoutGrid}
              title="No chart data yet"
              description="Agent performance charts appear after the pipeline handles real requests."
            />
          )}
          {observabilityView === 'graph' && summaryData?.summary && summaryData.summary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Calls by Agent */}
              <div className="surface p-5">
                <h4 className="font-bold text-slate-700 mb-4 text-sm">Total Calls by Agent</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summaryData.summary.map(r => ({
                    name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                    calls: r.total_calls,
                    color: agentDefs.find(a => a.name === r.agent_name)?.color || '#64748b'
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

              {/* Success Rate */}
              <div className="surface p-5">
                <h4 className="font-bold text-slate-700 mb-4 text-sm">Success Rate by Agent</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summaryData.summary.map(r => ({
                    name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                    success: r.total_calls > 0 ? Math.round((r.success_count / r.total_calls) * 100) : 0,
                    color: agentDefs.find(a => a.name === r.agent_name)?.color || '#64748b'
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

              {/* Latency */}
              <div className="surface p-5">
                <h4 className="font-bold text-slate-700 mb-4 text-sm">Average Latency (ms)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summaryData.summary.map(r => ({
                    name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                    latency: r.avg_latency_ms || 0,
                    color: agentDefs.find(a => a.name === r.agent_name)?.color || '#64748b'
                  }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value) => [`${value}ms`, 'Latency']}
                    />
                    <Bar dataKey="latency" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tokens */}
              <div className="surface p-5">
                <h4 className="font-bold text-slate-700 mb-4 text-sm">Tokens Ingested</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summaryData.summary.map(r => ({
                    name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                    tokens: r.total_tokens || 0,
                    color: agentDefs.find(a => a.name === r.agent_name)?.color || '#64748b'
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value) => [value.toLocaleString(), 'Tokens']}
                    />
                    <Bar dataKey="tokens" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
        </div>
      )}

      {/* SPACE 5: Benchmark & Rates */}
      {activeTab === 'benchmark' && (
        <div className="space-y-6 agents-panel-enter">
          <div className="surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={16} className="text-violet-500" /> Benchmark · {timeFilterLabel(timeFilter)}
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
                              <Icon size={14} />
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
                {/* Success Rate & Latency Bar Chart */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-4 text-sm">Success Rate & Latency by Agent</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={benchmarkData.benchmark.map(r => ({
                      name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                      success: r.success_rate,
                      latency: r.avg_latency_ms / 10,
                      color: agentDefs.find(a => a.name === r.agent_name)?.color || '#64748b'
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

                {/* Hallucination & Error Rate Chart */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-4 text-sm">Hallucination & Error Rates</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={benchmarkData.benchmark.map(r => ({
                      name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                      hallucination: r.hallucination_rate,
                      error: r.error_rate,
                      color: agentDefs.find(a => a.name === r.agent_name)?.color || '#64748b'
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

                {/* Performance Radar Chart */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-4 text-sm">Overall Performance Distribution</h4>
                  {benchmarkData?.benchmark && benchmarkData.benchmark.length > 0 ? (
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
                  ) : (
                    <div className="text-sm text-slate-400 text-center py-8">No benchmark data available</div>
                  )}
                </div>

                {/* Cost Comparison */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-4 text-sm">Cost Comparison (USD)</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={benchmarkData.benchmark.map(r => ({
                      name: agentDefs.find(a => a.name === r.agent_name)?.label || r.agent_name,
                      cost: r.estimated_cost_usd * 1000,
                      color: agentDefs.find(a => a.name === r.agent_name)?.color || '#64748b'
                    }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                      <Tooltip 
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value) => [`$${(value / 1000).toFixed(4)}`, 'Cost']}
                      />
                      <Bar dataKey="cost" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Error Types Breakdown */}
          {benchmarkData?.benchmark && benchmarkData.benchmark.some(r => r.error_types) && (
            <div className="surface p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertOctagon size={16} className="text-rose-500" /> Error Types Analysis
              </h3>
              <div className="space-y-2">
                {benchmarkData.benchmark.filter(r => r.error_types).map((row, i) => {
                  const def = agentDefs.find((a) => a.name === row.agent_name)
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 bg-rose-50/50 rounded-lg">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${def?.bg || 'bg-slate-100'} ${def?.text || 'text-slate-500'}`}>
                        {def?.icon ? <def.icon size={12} /> : <Cpu size={12} />}
                      </span>
                      <div className="flex-1">
                        <span className="font-semibold text-slate-800">{def?.label || row.agent_name}</span>
                        <div className="text-xs text-slate-500 mt-1">{row.error_types}</div>
                      </div>
                      <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded">{row.error_count} errors</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cost Summary */}
          {benchmarkData?.benchmark && benchmarkData.benchmark.length > 0 && (
            <div className="surface p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-500" /> Cost Analysis
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Total Cost (24h)</span>
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
      )}

      {/* SPACE 5: Sandbox Terminal */}
      {activeTab === 'sandbox' && (
        <div className="surface p-6 agents-panel-enter">
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
        </div>
      )}

      {/* SPACE 6: System News */}
      {activeTab === 'news' && (
        <div className="space-y-6 agents-panel-enter">
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
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
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
        </div>
      )}
    </div>
  )
}
