import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  Command, Sparkles, ShieldCheck, Zap, Activity, Cpu, MoreHorizontal, Timer,
} from 'lucide-react'
import CcBackground from './Background'
import NetworkGraph from './NetworkGraph'
import AgentCapsules from './AgentCapsules'
import IntelligencePanel from './IntelligencePanel'
import AITimeline, { TimelineInspector } from './AITimeline'
import ActivityStream from './ActivityStream'
import CommandPalette from './CommandPalette'
import ConversationInspector from './ConversationInspector'
import AgentDetailPanel from './AgentDetailPanel'
import ModeTabs from './ModeTabs'
import WorkflowView from './WorkflowView'
import TimelineView from './TimelineView'
import AnalyticsView from './AnalyticsView'
import DebugView from './DebugView'
import { useControlSimulation } from './useControlSimulation'
import toast from 'react-hot-toast'

function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function ControlCenter({
  agents, status, metrics, onOpenWorkflow, onOpenChat,
}) {
  const {
    live, roster, events, pulses, timeline, history, counters, log, uptime,
    dismissEvent, actions,
  } = useControlSimulation({ agents, status, metrics })

  const [focusedAgent, setFocusedAgent] = useState(null)
  const [hoveringAgent, setHoveringAgent] = useState(null)
  const [intelCollapsed, setIntelCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [convPair, setConvPair] = useState(null)
  const [inspectorStep, setInspectorStep] = useState(null)
  const [actionScop, setActionScop] = useState(null)
  const [mode, setMode] = useState(() => localStorage.getItem('cc:mode') || 'network')
  const now = useClock()

  useEffect(() => {
    localStorage.setItem('cc:mode', mode)
  }, [mode])

  useEffect(() => {
    const stored = localStorage.getItem('cc:intel')
    if (stored) setIntelCollapsed(stored === '1')
  }, [])
  useEffect(() => {
    localStorage.setItem('cc:intel', intelCollapsed ? '1' : '0')
  }, [intelCollapsed])

  // expose cloned/created agents too
  const liveAll = live.map((l) => {
    const base = (roster || agents).find((a) => a.name === l.name)
    return {
      name: l.name,
      label: base?.label || l.name,
      icon: base?.icon,
      color: base?.color || '#64748b',
      model: base?.model,
      desc: base?.desc,
      provider: base?.provider,
      fallback: base?.fallback,
      ll: l.liveliness,
      online: Boolean(l.online),
    }
  })

  const working = liveAll.filter((a) => a.ll?.phase === 'working').length
  const thinking = liveAll.filter((a) => a.ll?.phase === 'thinking').length
  const idle = liveAll.filter((a) => a.ll?.phase === 'idle').length
  const resting = liveAll.filter((a) => a.ll?.phase === 'resting').length

  const focused = liveAll.find((a) => a.name === focusedAgent) || null

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (convPair) setConvPair(null)
        else if (paletteOpen) setPaletteOpen(false)
        else if (inspectorStep) setInspectorStep(null)
        else if (focusedAgent && actionScop !== 'detail') setFocusedAgent(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convPair, paletteOpen, inspectorStep, focusedAgent])

  const handleCommand = (id, name) => {
    const target = name || focusedAgent || 'orchestrator'
    switch (id) {
      case 'create-agent':
        if (actions.createAgent()) toast.success('Agent spawned into the network')
        break
      case 'clone-agent':
        if (actions.cloneAgent(target)) toast.success(`Cloned ${target}`)
        else toast.error('No agent to clone')
        break
      case 'pause-agent':
        if (actions.pauseAgent(target)) toast.success(`${target} set to rest`)
        break
      case 'resume-agent':
        if (actions.resumeAgent(target)) toast.success(`${target} resumed`)
        break
      case 'run-workflow':
        setMode('workflow')
        toast.success('Workflow fired — follow the pipeline below')
        break
      case 'open-logs':
        setMode('debug')
        onOpenWorkflow?.()
        break
      case 'inspect-memory':
        setConvPair({ agentA: agents.find((a) => a.name === 'orchestrator'), agentB: liveAll.find((a) => a.name === target) || null })
        break
      case 'assign-task':
        setMode('workflow')
        toast.success(`Task assigned to ${target}`)
        break
      default:
        toast(`Commanded: ${id.replace(/-/g, ' ')}`)
    }
  }

  const openConversation = (name) => {
    const orb = agents.find((a) => a.name === 'orchestrator')
    const other = (roster || agents).find((a) => a.name === name) || liveAll.find((a) => a.name === name)
    setConvPair({ agentA: orb, agentB: other })
  }

  const modeProps = {
    steps: timeline,
    live: liveAll,
    history,
    counters,
    log,
    uptime,
    onInspect: (id) => setInspectorStep(id),
    onFire: () => {
      setMode('workflow')
      toast.success('Workflow fired')
    },
  }

  return (
    <div className="cc-root">
      <CcBackground className="cc-root-bg" />

      {/* top control strip */}
      <div className="cc-topbar">
        <div className="cc-topbar-left">
          <div className="cc-brand">
            <span className="cc-brand-icon"><Sparkles size={15} /></span>
            <div>
              <span className="cc-brand-title">AI Ecosystem</span>
              <span className="cc-brand-sub">living agent control</span>
            </div>
          </div>
        </div>
        <div className="cc-topbar-center">
          <HealthPill icon={Zap} label="Working" value={working} tone="emerald" />
          <HealthPill icon={Activity} label="Thinking" value={thinking} tone="violet" />
          <HealthPill icon={Cpu} label="Idle" value={idle} tone="sky" />
          <HealthPill icon={ShieldCheck} label="Resting" value={resting} tone="slate" />
        </div>
        <div className="cc-topbar-right">
          <span className="cc-clock" title="Session uptime">
            <Timer size={12} />
            {new Date(now - uptime).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
          </span>
          <button type="button" className="cc-tool-btn cc-open-palette" onClick={() => setPaletteOpen(true)}>
            <Command size={14} /> <span>Command</span> <kbd>space</kbd>
          </button>
          <button type="button" className="cc-tool-btn" onClick={() => onOpenChat?.()}>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* mode switch */}
      <div className="cc-stagebar">
        <ModeTabs mode={mode} onChange={(m) => { setMode(m); setFocusedAgent(null); setActionScop(null) }} />
      </div>

      {/* main stage */}
      <div className="cc-stage">
        <div className="cc-main">
          {mode === 'network' && (
            <>
              <AgentCapsules agents={liveAll} live={live} onOpen={(name) => { setFocusedAgent(name); setActionScop('detail') }} />
              <div className="cc-network-wrap">
                <NetworkGraph
                  agents={liveAll}
                  live={live}
                  pulses={pulses}
                  focusedAgent={focusedAgent}
                  hoveringAgent={hoveringAgent}
                  onSelect={(name) => { setFocusedAgent(name); setActionScop('detail') }}
                  onHover={setHoveringAgent}
                  onClear={() => { setFocusedAgent(null); setActionScop(null) }}
                  onOpenConnection={(name) => {
                    setFocusedAgent(null)
                    setActionScop(null)
                    openConversation(name)
                  }}
                />
                <div className="cc-network-hint">
                  hover an agent · click to zoom · <button type="button" className="cc-link-inline" onClick={openConversation}>click a line</button> to inspect a conversation
                </div>
              </div>
              <AITimeline
                steps={timeline}
                activeStep={inspectorStep}
                onInspect={setInspectorStep}
              />
            </>
          )}
          {mode === 'workflow' && <WorkflowView {...modeProps} />}
          {mode === 'timeline' && <TimelineView {...modeProps} />}
          {mode === 'analytics' && <AnalyticsView history={history} counters={counters} />}
          {mode === 'debug' && <DebugView log={log} counters={counters} uptime={uptime} onClear={() => actions.clearLog()} />}
        </div>

        <IntelligencePanel
          counters={counters}
          live={liveAll}
          collapsed={intelCollapsed}
          onToggle={() => setIntelCollapsed((v) => !v)}
          onNavigate={() => setMode('timeline')}
        />
      </div>

      {/* overlapping UI layers */}
      <ActivityStream events={events} onDismiss={dismissEvent} />
      <AgentDetailPanel
        agent={focused}
        ll={focused?.ll}
        online={focused?.online}
        onClose={() => { setFocusedAgent(null); setActionScop(null) }}
        onCommand={handleCommand}
      />
      <ConversationInspector
        open={Boolean(convPair)}
        agentA={convPair?.agentA}
        agentB={convPair?.agentB}
        onClose={() => setConvPair(null)}
      />

      <AnimatePresence>
        {inspectorStep && (
          <div className="cc-tl-inspector-backdrop" onClick={() => setInspectorStep(null)}>
            <TimelineInspector stepId={inspectorStep} onClose={() => setInspectorStep(null)} />
          </div>
        )}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        onOpen={() => setPaletteOpen(true)}
        onClose={() => setPaletteOpen(false)}
        onCommand={handleCommand}
        targetName={focusedAgent}
      />
    </div>
  )
}

function HealthPill({ icon: Icon, label, value, tone }) {
  return (
    <div className={`cc-health cc-health-${tone}`}>
      <Icon size={12} />
      <span className="cc-health-label">{label}</span>
      <span className="cc-health-value">{value}</span>
    </div>
  )
}