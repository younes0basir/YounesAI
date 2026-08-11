import { useMemo, useState } from 'react'
import {
  Brain, Clock, Database, Radio, ArrowRight, Sparkles, GitBranch,
  MessageSquare, Wrench, ChevronRight, Play,
} from 'lucide-react'

const PIPELINE_EXAMPLES = [
  {
    id: 'task',
    label: 'Task + date',
    prompt: 'Create a task for 21 this month named internship',
    routes: ['task'],
    needsTemporal: true,
    cleaned: 'Create a task named internship',
    parsedDate: '2026-08-21',
    tool: 'createTask',
    result: 'Task saved with title + due date',
  },
  {
    id: 'event',
    label: 'Calendar event',
    prompt: 'Create event for 15 this month named team sync',
    routes: ['event'],
    needsTemporal: true,
    cleaned: 'Create event named team sync',
    parsedDate: '2026-08-15',
    tool: 'createEvent',
    result: 'Event stored in calendar table',
  },
  {
    id: 'file',
    label: 'File search',
    prompt: 'What documents mention the internship budget?',
    routes: ['file'],
    needsTemporal: false,
    cleaned: null,
    parsedDate: null,
    tool: 'retrieveDocuments',
    result: 'RAG chunks returned to synthesizer',
  },
  {
    id: 'multi',
    label: 'Multi-intent',
    prompt: 'Remind me to call HR tomorrow and list my open tasks',
    routes: ['task', 'task'],
    needsTemporal: true,
    cleaned: 'Remind me to call HR and list my open tasks',
    parsedDate: '2026-08-12',
    tool: 'createTask · listTasks',
    result: 'Two tool calls, one merged reply',
  },
]

const STAGES = [
  { id: 'input', num: '01', title: 'User message', icon: MessageSquare },
  { id: 'orchestrator', num: '02', title: 'Orchestrator', icon: Brain },
  { id: 'temporal', num: '03', title: 'Temporal parse', icon: Clock },
  { id: 'agents', num: '04', title: 'Specialist agents', icon: GitBranch },
  { id: 'tools', num: '05', title: 'Tools & storage', icon: Wrench },
]

export default function PipelineFlow({ agentDefs, agentsFlat, status, onRunExample }) {
  const [exampleId, setExampleId] = useState(PIPELINE_EXAMPLES[0].id)
  const [activeStage, setActiveStage] = useState('input')

  const example = useMemo(
    () => PIPELINE_EXAMPLES.find((e) => e.id === exampleId) || PIPELINE_EXAMPLES[0],
    [exampleId]
  )

  const routedAgents = useMemo(
    () => [...new Set(example.routes)].map((name) => agentDefs.find((a) => a.name === name)).filter(Boolean),
    [example.routes, agentDefs]
  )

  const isAgentLive = (name) => {
    if (name === 'orchestrator') return status?.orchestrator === 'active'
    return status?.agents?.includes(name)
  }

  return (
    <section className="pipeline-flow" aria-label="Decoupled AI routing pipeline">
      <header className="pipeline-header">
        <div className="pipeline-header-copy">
          <span className="pipeline-kicker">Architecture</span>
          <h2>Decoupled AI routing pipeline</h2>
          <p>
            Every chat message flows through intent routing, optional date extraction,
            specialist agents, and structured tools — without mixing responsibilities.
          </p>
        </div>
        <div className="pipeline-legend">
          <span><i className="pipeline-dot pipeline-dot-live" /> Live node</span>
          <span><i className="pipeline-dot pipeline-dot-route" /> Routed in example</span>
          <span><i className="pipeline-dot pipeline-dot-skip" /> Skipped step</span>
        </div>
      </header>

      <div className="pipeline-examples">
        <span className="pipeline-examples-label">Walk through:</span>
        {PIPELINE_EXAMPLES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pipeline-example-chip ${exampleId === item.id ? 'active' : ''}`}
            onClick={() => { setExampleId(item.id); setActiveStage('input') }}
          >
            {item.label}
          </button>
        ))}
        {onRunExample && (
          <button
            type="button"
            className="pipeline-run-btn"
            onClick={() => onRunExample(example.prompt)}
          >
            <Play size={13} />
            Run in sandbox
          </button>
        )}
      </div>

      <div className="pipeline-layout">
        {/* Left: visual flow */}
        <div className="pipeline-canvas surface">
          <div className="pipeline-canvas-grid" aria-hidden="true" />

          <div className="pipeline-track">
            {STAGES.map((stage, index) => {
              const Icon = stage.icon
              const isTemporal = stage.id === 'temporal'
              const skipped = isTemporal && !example.needsTemporal
              const isActive = activeStage === stage.id
              const isPast = STAGES.findIndex((s) => s.id === activeStage) > index

              return (
                <div key={stage.id} className="pipeline-track-segment">
                  <button
                    type="button"
                    className={`pipeline-stage ${isActive ? 'is-active' : ''} ${isPast ? 'is-past' : ''} ${skipped ? 'is-skipped' : ''}`}
                    onClick={() => setActiveStage(stage.id)}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className="pipeline-stage-num">{stage.num}</span>
                    <span className="pipeline-stage-icon">
                      <Icon size={16} />
                    </span>
                    <span className="pipeline-stage-title">{stage.title}</span>
                    {skipped && <span className="pipeline-stage-badge">Bypassed</span>}
                  </button>
                  {index < STAGES.length - 1 && (
                    <div className={`pipeline-connector ${skipped && index === 2 ? 'is-dim' : ''} ${isPast ? 'is-past' : ''}`}>
                      <ChevronRight size={14} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="pipeline-diagram">
            {/* Input node */}
            <div className={`pipeline-node pipeline-node-input ${activeStage === 'input' ? 'is-highlight' : ''}`}>
              <div className="pipeline-node-label"><Radio size={12} /> Incoming prompt</div>
              <blockquote className="pipeline-prompt">&ldquo;{example.prompt}&rdquo;</blockquote>
            </div>

            <div className="pipeline-spine" aria-hidden="true">
              <div className="pipeline-spine-line" />
            </div>

            {/* Orchestrator hub */}
            <div className={`pipeline-node pipeline-node-orchestrator ${activeStage === 'orchestrator' ? 'is-highlight' : ''}`}>
              <div className="pipeline-orchestrator-core">
                <Brain size={22} />
                <strong>Orchestrator</strong>
                <span>llama-3.3 · intent + routing</span>
              </div>
              <div className="pipeline-route-tags">
                {routedAgents.map((agent) => (
                  <span key={agent.name} className="pipeline-route-tag" style={{ '--agent-color': agent.color }}>
                    {agent.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Temporal branch */}
            <div className={`pipeline-node pipeline-node-temporal ${!example.needsTemporal ? 'is-skipped' : ''} ${activeStage === 'temporal' ? 'is-highlight' : ''}`}>
              <div className="pipeline-node-label"><Clock size={12} /> Temporal utility</div>
              {example.needsTemporal ? (
                <div className="pipeline-transform">
                  <div className="pipeline-transform-row">
                    <span className="pipeline-transform-key">Extracted</span>
                    <code>{example.parsedDate}</code>
                  </div>
                  <div className="pipeline-transform-row">
                    <span className="pipeline-transform-key">Cleaned msg</span>
                    <code>{example.cleaned}</code>
                  </div>
                </div>
              ) : (
                <p className="pipeline-skip-note">No date expressions — agent receives the original message.</p>
              )}
            </div>

            {/* Agent fan-out */}
            <div className={`pipeline-node pipeline-node-agents ${activeStage === 'agents' ? 'is-highlight' : ''}`}>
              <div className="pipeline-node-label"><GitBranch size={12} /> Specialist fan-out</div>
              <div className="pipeline-agent-grid">
                {agentsFlat.map((agent) => {
                  const Icon = agent.icon
                  const routed = example.routes.includes(agent.name)
                  const live = isAgentLive(agent.name)
                  return (
                    <div
                      key={agent.name}
                      className={`pipeline-agent-chip ${routed ? 'is-routed' : ''} ${live ? 'is-live' : ''}`}
                      style={{ '--agent-color': agent.color }}
                    >
                      <Icon size={13} />
                      <span>{agent.label.replace(' Agent', '')}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tools */}
            <div className={`pipeline-node pipeline-node-tools ${activeStage === 'tools' ? 'is-highlight' : ''}`}>
              <div className="pipeline-node-label"><Database size={12} /> Tool layer</div>
              <div className="pipeline-tools-row">
                <span className="pipeline-tool-call">{example.tool}</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="pipeline-tool-result">{example.result}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: step inspector */}
        <aside className="pipeline-inspector surface">
          <div className="pipeline-inspector-head">
            <Sparkles size={15} className="text-primary-600" />
            <h3>Step inspector</h3>
          </div>

          <ol className="pipeline-inspector-steps">
            <InspectorStep
              active={activeStage === 'input'}
              onClick={() => setActiveStage('input')}
              title="Capture raw intent"
              body="The user message enters unchanged. Folder context and recent chat history are attached."
            />
            <InspectorStep
              active={activeStage === 'orchestrator'}
              onClick={() => setActiveStage('orchestrator')}
              title="Classify & route"
              body={`Orchestrator picks ${routedAgents.map((a) => a.label).join(', ') || 'specialists'} and sets needs_parsing when dates are detected.`}
            />
            <InspectorStep
              active={activeStage === 'temporal'}
              onClick={() => setActiveStage('temporal')}
              title="Resolve dates (optional)"
              body={example.needsTemporal
                ? 'chrono-node + custom rules strip time phrases and inject ISO timestamps before the agent LLM runs.'
                : 'Skipped — no temporal expressions in this message.'}
              muted={!example.needsTemporal}
            />
            <InspectorStep
              active={activeStage === 'agents'}
              onClick={() => setActiveStage('agents')}
              title="Agent JSON + tools"
              body="Each specialist LLM returns structured JSON (create/update/list). Title recovery runs if the model misses names."
            />
            <InspectorStep
              active={activeStage === 'tools'}
              onClick={() => setActiveStage('tools')}
              title="Persist & respond"
              body="Validated records hit Postgres. Orchestrator synthesizes a final natural-language reply for chat."
            />
          </ol>

          <div className="pipeline-inspector-footer">
            <span className="badge badge-muted">Provider fallback: NVIDIA → Groq → OpenRouter</span>
          </div>
        </aside>
      </div>
    </section>
  )
}

function InspectorStep({ active, onClick, title, body, muted = false }) {
  return (
    <li>
      <button
        type="button"
        className={`pipeline-inspector-step ${active ? 'is-active' : ''} ${muted ? 'is-muted' : ''}`}
        onClick={onClick}
      >
        <strong>{title}</strong>
        <p>{body}</p>
      </button>
    </li>
  )
}
