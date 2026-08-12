import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HeartPulse, Brain, Zap, MemoryStick } from 'lucide-react'
import { AGENT_AURAS } from './ccData'

export default function NetworkGraph({
  agents, live, pulses, focusedAgent, hoveringAgent,
  onSelect, onHover, onClear, onOpenConnection,
}) {
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 760, h: 420 })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // gentle rotation every frame (throttled to ~30fps)
  useEffect(() => {
    let raf = 0
    let last = 0
    const step = (now) => {
      raf = requestAnimationFrame(step)
      if (now - last > 40) {
        last = now
        setTick((t) => t + 0.0016)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const { w, h } = size
  const cx = w / 2
  const cy = h / 2
  const rx = Math.min(w * 0.34, 300)
  const ry = Math.min(h * 0.33, 200)

  const positions = agents.map((a, i) => {
    const isOrch = a.name === 'orchestrator'
    if (isOrch) return { x: cx, y: cy }
    const base = 2 * Math.PI * (i / agents.length) - Math.PI / 2
    const ang = base + tick * (4 + (i % 3) * 0.6)
    return { x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry * 0.82 }
  })

  // Which node is currently "zoomed" (focused) or hovered
  const selPos = focusedAgent
    ? positions[agents.findIndex((a) => a.name === focusedAgent)]
    : null
  const zoom = Boolean(selPos)

  const activePulses = pulses.filter((p) => p.agentName !== 'orchestrator')

  const renderNode = (agent, i) => {
    const pos = positions[i]
    if (!pos) return null
    const ll = live.find((l) => l.name === agent.name)?.liveliness
    const isOnline = live.find((l) => l.name === agent.name)?.online
    const phase = isOnline ? (ll?.phase || 'idle') : 'resting'
    const aura = AGENT_AURAS[phase] || AGENT_AURAS.idle
    const isFocused = focusedAgent === agent.name
    const isHovered = hoveringAgent === agent.name
    const isOrch = agent.name === 'orchestrator'
    const r = isOrch ? 46 : 30
    const Icon = agent.icon
    const hasPulse = pulses.some((p) => p.agentName === agent.name)

    return (
      <motion.g
        key={agent.name}
        className="cc-node"
        style={{ filter: zoom && !isFocused ? 'saturate(0.35) brightness(0.92)' : 'none' }}
      >
        {/* connection line */}
        <motion.line
          x1={cx}
          y1={cy}
          x2={pos.x}
          y2={pos.y}
          stroke={agent.color}
          strokeOpacity={hasPulse ? 0.9 : (isOrch ? 0 : 0.22)}
          strokeWidth={hasPulse ? 2.2 : 1}
          strokeLinecap="round"
          animate={{ strokeOpacity: hasPulse ? 0.9 : 0.22 }}
          className={`cc-link ${hasPulse ? 'cc-link-pulse' : ''}`}
        />
        {/* invisible wider click target: open conversation inspector */}
        {!isOrch && (
          <line
            x1={cx}
            y1={cy}
            x2={pos.x}
            y2={pos.y}
            stroke="transparent"
            strokeWidth={14}
            strokeLinecap="round"
            onClick={(e) => { e.stopPropagation(); onOpenConnection?.(agent.name) }}
            className="cc-line-hit"
          />
        )}

        {/* traveling pulse dot */}
        <AnimatePresence>
          {hasPulse && !isOrch && activePulses.find((p) => p.agentName === agent.name) && (
            <motion.circle
              key={`dot-${agent.name}-${pulses.filter((p) => p.agentName === agent.name).length}`}
              r={4}
              fill={agent.color}
              initial={{ cx, cy, opacity: 0 }}
              animate={{ cx: pos.x, cy: pos.y, opacity: [0, 1, 0.6] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.95, ease: 'easeInOut' }}
              className="cc-pulse-dot"
            />
          )}
        </AnimatePresence>

        {/* breathing glow */}
        <motion.circle
          cx={pos.x}
          cy={pos.y}
          r={r * 1.7}
          fill={agent.color}
          opacity={0.0}
          animate={{ opacity: [0.12, 0.24, 0.12], r: [r * 1.6, r * 1.9, r * 1.6] }}
          transition={{ duration: 3 + (i % 3) * 0.4, repeat: Infinity, ease: 'easeInOut' }}
          className="cc-node-glow"
        />

        {/* node body */}
        <motion.circle
          cx={pos.x}
          cy={pos.y}
          r={r}
          fill={isOrch ? 'url(#ccOrchGrad)' : 'url(#ccNodeGrad)'}
          stroke={agent.color}
          strokeWidth={isFocused ? 3 : (isHovered ? 2.4 : 1.4)}
          style={{ filter: `drop-shadow(0 6px 14px ${agent.color}55)` }}
          initial={false}
          animate={{
            r: isHovered || isFocused ? r * 1.22 : r,
            strokeWidth: isFocused ? 3 : (isHovered ? 2.4 : 1.4),
          }}
          whileHover={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="cc-node-body"
          onMouseEnter={() => onHover(agent.name)}
          onMouseLeave={() => onHover(null)}
        />

        {/* center dot for orchestrator */}
        {isOrch && (
          <motion.circle
            cx={pos.x}
            cy={pos.y}
            r={r * 0.28}
            fill="#fff"
            opacity={0.85}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
        )}

        {/* thinking ring (spinning dashes) when thinking */}
        {phase === 'thinking' && (
          <motion.circle
            cx={pos.x}
            cy={pos.y}
            r={r + 6}
            fill="none"
            stroke={aura.color || agent.color}
            strokeWidth={1.6}
            strokeDasharray="5 7"
            strokeLinecap="round"
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            className="cc-node-thinking"
          />
        )}

        {/* heartbeat ticker when working */}
        {phase === 'working' && (
          <Heartbeat cx={pos.x} cy={pos.y} r={r + 8} color={agent.color} />
        )}

        {/* agent icon */}
        <g className="cc-node-icon-g">
          <rect
            x={pos.x - 12}
            y={pos.y - 12}
            width={24}
            height={24}
            rx={7}
            fill="rgba(255,255,255,0.95)"
          />
          <Icon x={pos.x - 11} y={pos.y - 11} size={22} color={agent.color} />
        </g>

        {/* label */}
        <motion.text
          x={pos.x}
          y={pos.y + r + 22}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill={isFocused ? agent.color : '#5c5a70'}
          className="cc-node-label"
          animate={{ y: pos.y + (isHovered ? r * 1.22 : r) + 22 }}
        >
          {agent.label.replace(' Agent', '')}
        </motion.text>

        {/* status ring / aura */}
        <motion.circle
          cx={pos.x}
          cy={pos.y}
          r={r + 2}
          fill="none"
          stroke={aura.color}
          strokeWidth={1.4}
          opacity={phase === 'resting' ? 0.4 : 0.85}
          animate={{ opacity: phase === 'working' ? [0.7, 1, 0.7] : 0.8 }}
          transition={phase === 'working' ? { duration: 1.4, repeat: Infinity } : {}}
          className={`cc-node-ring cc-node-ring-${phase}`}
        />
      </motion.g>
    )
  }

  return (
    <div className="cc-graph" ref={wrapRef} onClick={() => zoom && onClear()}>
      <motion.div
        className="cc-graph-stage"
        animate={selPos ? { scale: 1.7 } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        style={{
          transformOrigin: selPos
            ? `${(selPos.x / (w || 1)) * 100}% ${(selPos.y / (h || 1)) * 100}%`
            : '50% 50%',
        }}
      >
      <svg
        className="cc-graph-svg"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
      >
        <defs>
          <radialGradient id="ccNodeGrad" cx="30%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f3f0ff" />
          </radialGradient>
          <radialGradient id="ccOrchGrad" cx="30%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#f5f3ff" />
            <stop offset="55%" stopColor="#ede9fe" />
            <stop offset="100%" stopColor="#ddd6fe" />
          </radialGradient>
        </defs>

        {/* faint orbit guide circles */}
        <circle className="cc-graph-orbit cc-graph-orbit-mid" cx={cx} cy={cy} r={(rx + ry) / 2} />
        <circle className="cc-graph-orbit" cx={cx} cy={cy} r={rx} />

        {agents.map((a, i) => {
          return renderNode(a, i)
        })}

        {/* zoom-in click targets (invisible bigger circles) */}
        {agents.map((a, i) => {
          const pos = positions[i]
          if (!pos) return null
          return (
            <circle
              key={`hit-${a.name}`}
              cx={pos.x}
              cy={pos.y}
              r={46}
              fill="transparent"
              onClick={(e) => { e.stopPropagation(); onSelect(a.name) }}
              className="cc-node-hit"
            />
          )
        })}

        {/* zoom focus frame */}
        {selPos && (
          <motion.ellipse
            cx={selPos.x}
            cy={selPos.y}
            rx={70}
            ry={58}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth={1.6}
            strokeDasharray="4 6"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3.4, repeat: Infinity }}
            className="cc-focus-ring"
          />
        )}
      </svg>
      </motion.div>

      {/* hover tooltip - absolutely positioned card */}
      <AnimatePresence>
        {hoveringAgent && !focusedAgent && (
          <NodeTooltip
            agent={agents.find((a) => a.name === hoveringAgent)}
            ll={live.find((l) => l.name === hoveringAgent)?.liveliness}
            online={live.find((l) => l.name === hoveringAgent)?.online}
            pos={positions[agents.findIndex((a) => a.name === hoveringAgent)]}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Heartbeat({ cx, cy, r, color }) {
  const pts = [
    { x: cx - r, y: cy },
    { x: cx - r * 0.55, y: cy },
    { x: cx - r * 0.42, y: cy - 3 },
    { x: cx - r * 0.28, y: cy },
    { x: cx + r * 0.05, y: cy },
    { x: cx + r * 0.2, y: cy - 3 },
    { x: cx + r * 0.32, y: cy },
    { x: cx + r, y: cy },
  ]
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.7}
      animate={{
        pathLength: [0.3, 0, 0.3],
        opacity: [0.2, 0.9, 0.2],
      }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      className="cc-heartbeat"
    />
  )
}

function NodeTooltip({ agent, ll, online, pos }) {
  const Icon = agent.icon
  const phase = online ? (ll?.phase || 'idle') : 'resting'
  const aura = AGENT_AURAS[phase] || AGENT_AURAS.idle
  const x = pos?.x || 0
  const y = pos?.y || 0
  return (
    <motion.div
      className="cc-tooltip"
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      style={{ left: x + 34, top: y - 30 }}
    >
      <div className="cc-tooltip-head">
        <span className="cc-tooltip-icon" style={{ background: agent.color }}>
          <Icon size={14} />
        </span>
        <div>
          <div className="cc-tooltip-name">{agent.label}</div>
          <div className="cc-tooltip-role">{agent.model}</div>
        </div>
        <span className="cc-tooltip-status" style={{ color: aura.color }}>
          <span className="cc-tooltip-dot" style={{ background: aura.color }} />
          {phase}
        </span>
      </div>
      <div className="cc-tooltip-rows">
        <TooltipRow icon={<Brain size={11} />} label="Task" value={ll?.task || '—'} />
        <TooltipRow icon={<HeartPulse size={11} />} label="Confidence" value={`${ll?.confidence || 0}%`} />
        <TooltipRow icon={<Zap size={11} />} label="Tokens" value={`${Math.round((ll?.tokensUsed || 0) / 1000)}k`} />
        <TooltipRow icon={<MemoryStick size={11} />} label="Memory" value={`${Math.round((ll?.memoryUsage || 0) * 100)}%`} />
      </div>
      <div className="cc-tooltip-foot">{ll?.lastAction || 'Standing by'}</div>
    </motion.div>
  )
}

function TooltipRow({ icon, label, value }) {
  return (
    <div className="cc-tooltip-row">
      <span className="cc-tooltip-row-icon">{icon}</span>
      <span className="cc-tooltip-row-label">{label}</span>
      <span className="cc-tooltip-row-value">{value}</span>
    </div>
  )
}