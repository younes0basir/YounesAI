import { useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_KINDS } from './ccData';

const MAX_EVENTS = 7;
const MAX_LOG = 48;
const MAX_HISTORY = 40;
const AGENT_POOL = {
  synth: {
    label: 'Synth Agent',
    color: '#14b8a6',
    desc: 'Text generation specialist',
    model: 'groq/llama-3.3-70b-versatile',
  },
  vision: {
    label: 'Vision Agent',
    color: '#0ea5e9',
    desc: 'Image understanding & OCR',
    model: 'openrouter/qwen2.5-vl-72b',
  },
  audio: {
    label: 'Audio Agent',
    color: '#f97316',
    desc: 'Speech transcription & TTS',
    model: 'groq/whisper-large-v3-turbo',
  },
  data: {
    label: 'Data Agent',
    color: '#ef4444',
    desc: 'Structured retrieval & analytics',
    model: 'groq/llama-3.3-70b-versatile',
  },
};

const TASKS = {
  task: ['triaging incoming tasks', 'writing due-date reminders', 'merging task lists'],
  event: ['resolving calendar conflicts', 'drafting meeting invites', 'checking availability'],
  place: ['geocoding a location', 'fuzzy-matching street addresses', 'validating coordinates'],
  file: ['scanning a folder for documents', 'extracting text chunks', 'building file cache'],
  memory: ['running semantic search', 'upserting new memory', 'pruning stale facts'],
  general: ['answering a casual question', 'routing an open-ended query', 'composing a follow-up'],
  desktop: ['indexing local folders', 'discovering new files', 'watching directory changes'],
  image: ['generating an image', 'upscaling the render', 'refining the prompt'],
  email: ['summarizing inbox threads', 'classifying new mail', 'archiving read mail'],
  gemma: ['synthesizing a long answer', 'rechecking the reasoning chain', 'fallback analysis'],
};

const REASONING = [
  'Parsed intent and extracted entities from the prompt.',
  'Weighed routing scores against provider fallback rules.',
  'Selected the most specific specialist for this request.',
  'Checked memory for a relevant cached result first.',
  'Chose a tool, validated inputs, and dispatched the call.',
  'Composed a reply grounded in the returned data.',
];

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function seededAgentLiveliness(agent, n) {
  const base = (typeof agent.name === 'string' ? agent.name.length : 5) + n;
  const conf = 0.72 + ((base * 13) % 20) / 100;
  const tokens = 2400 + ((base * 37) % 60) * 90;
  return {
    phase: 'idle',
    task: randomOf(TASKS[agent.name] || TASKS.general),
    confidence: Math.round(conf * 100),
    tokensUsed: tokens,
    memoryUsage: 0.4 + ((base % 5) * 7) / 100,
    lastAction: 'Standing by',
    reasoning: [],
  };
}

const STAGE_WALK = ['request', 'planner', 'research', 'knowledge', 'coder', 'reviewer', 'final'];
const USAGE_STORAGE_PREFIX = 'cc:usage';

let cloneCounter = 0;

function readStoredUsage(storageKey) {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(`${USAGE_STORAGE_PREFIX}:${storageKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredUsage(storageKey, usage) {
  if (!storageKey || !usage) return;
  try {
    localStorage.setItem(`${USAGE_STORAGE_PREFIX}:${storageKey}`, JSON.stringify(usage));
  } catch {
    // ignore quota errors
  }
}

function buildUsageFromMetrics(metrics) {
  if (!metrics?.length) return null;
  const tokens = metrics.reduce((sum, m) => sum + (m.tokens_used || 0), 0);
  const requests = metrics.length;
  const latency = Math.round(
    metrics.reduce((sum, m) => sum + (m.latency_ms || 0), 0) / metrics.length
  );
  const cost = tokens * 0.0000002;
  return { tokens, cost, requests, latency };
}

function buildUsageFromBenchmark(benchmark) {
  if (!benchmark?.length) return null;
  const tokens = benchmark.reduce((sum, row) => sum + (row.total_tokens || 0), 0);
  const cost = benchmark.reduce((sum, row) => sum + (row.estimated_cost_usd || 0), 0);
  const requests = benchmark.reduce((sum, row) => sum + (row.total_calls || 0), 0);
  const latency = Math.round(
    benchmark.reduce((sum, row) => sum + (row.avg_latency_ms || 0), 0) / benchmark.length
  );
  return { tokens, cost, requests, latency };
}

function resolveUsageTotals({ usageTotals, benchmark, metrics, storageKey }) {
  return (
    usageTotals ||
    buildUsageFromBenchmark(benchmark) ||
    buildUsageFromMetrics(metrics) ||
    readStoredUsage(storageKey) || {
      tokens: 0,
      cost: 0,
      latency: 0,
      requests: 0,
      tasks: 2,
      tools: 1,
    }
  );
}

function metricsToHistory(metrics) {
  if (!metrics?.length) return [];
  const ordered = [...metrics].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let cumulativeTokens = 0;
  return ordered.slice(-MAX_HISTORY).map((row, index) => {
    cumulativeTokens += row.tokens_used || 0;
    return {
      t: new Date(row.created_at).getTime(),
      tokens: cumulativeTokens,
      latency: row.latency_ms || 0,
      requests: index + 1,
      working: row.success ? 1 : 0,
    };
  });
}

export function useControlSimulation({
  agents,
  status,
  metrics,
  benchmark,
  usageTotals,
  usageStorageKey,
}) {
  const onlineSet = useMemo(() => {
    const s = new Set((status?.agents || []).filter(Boolean));
    if (status?.orchestrator === 'active') s.add('orchestrator');
    return s;
  }, [status]);

  const [roster, setRoster] = useState(null);
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  useEffect(() => {
    if (!roster && agents.length > 0) setRoster(agents);
  }, [roster, agents]);

  const [live, setLive] = useState([]);
  // Keep live in sync with the roster
  useEffect(() => {
    setLive((prev) =>
      (roster || agents || []).map((a, i) => {
        const existing = prev.find((l) => l.name === a.name);
        if (existing)
          return {
            ...existing,
            name: a.name,
            online: onlineSet.size > 0 ? onlineSet.has(a.name) : existing.online,
          };
        return {
          name: a.name,
          online: onlineSet.size > 0 ? onlineSet.has(a.name) : true,
          liveliness: seededAgentLiveliness(a, i),
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, onlineSet]);

  const [events, setEvents] = useState([]);
  const [log, setLog] = useState([]);
  const [pulses, setPulses] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [history, setHistory] = useState(() => metricsToHistory(metrics));
  const [counters, setCounters] = useState(() =>
    resolveUsageTotals({ usageTotals, benchmark, metrics, storageKey: usageStorageKey })
  );
  const uptime = useRef(Date.now()).current;
  const stepCounter = useRef(0);

  const pushEvent = (agentName, kindOverride) => {
    const kind = kindOverride || randomOf(EVENT_KINDS);
    const agent = (roster || agents).find((a) => a.name === agentName);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setEvents((prev) => [
      ...prev.slice(-(MAX_EVENTS - 1)),
      {
        id,
        kind: kind.kind,
        label: kind.label,
        agentName,
        agentLabel: agent?.label || agentName,
        tone: kind.tone,
        ts: Date.now(),
      },
    ]);
    setPulses((prev) => [...prev.slice(-3), { id, agentName, color: agent?.color || '#8b5cf6' }]);
    setLog((prev) => [
      ...prev.slice(-(MAX_LOG - 1)),
      {
        id,
        ts: Date.now(),
        level: kind.kind === 'memory' ? 'info' : kind.kind,
        text: `${agent?.label || agentName} — ${kind.label}`,
      },
    ]);
  };

  // Sim tick: phase machine + liveliness drift
  useEffect(() => {
    const timer = setInterval(() => {
      setLive((prev) =>
        prev.map((agent) => {
          const ll = { ...agent.liveliness };
          if (Math.random() < 0.24) {
            ll.confidence = Math.min(99, ll.confidence + Math.floor(Math.random() * 6));
            ll.memoryUsage = Math.min(0.96, ll.memoryUsage + Math.random() * 0.02);
          }
          if (Math.random() < 0.28) {
            ll.task = randomOf(TASKS[agent.name] || TASKS.general);
            ll.lastAction = 'payload processed';
          }
          if (Math.random() < 0.2) {
            ll.tokensUsed += Math.round(1200 + Math.random() * 2600);
          }
          if (agent.online) {
            if (ll.phase === 'idle' && Math.random() < 0.3) ll.phase = 'thinking';
            else if (ll.phase === 'thinking' && Math.random() < 0.42) {
              ll.phase = 'working';
              ll.reasoning = [...(ll.reasoning || []).slice(-2), randomOf(REASONING)];
            } else if (ll.phase === 'working' && Math.random() < 0.26) {
              ll.phase = 'idle';
              ll.lastAction = 'Completed cycle';
            }
          } else {
            ll.phase = 'resting';
          }
          return { ...agent, liveliness: ll };
        })
      );
    }, 1600);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  // Live activity pulses (visual only — counters come from backend metrics).
  useEffect(() => {
    const timer = setInterval(() => {
      const alive = live.filter((l) => l.online);
      if (alive.length === 0) return;
      if (Math.random() < 0.55) {
        const target = alive[Math.floor(Math.random() * alive.length)];
        pushEvent(target.name);
      }
      stepCounter.current = (stepCounter.current + 1) % 6;
      const stage = STAGE_WALK[stepCounter.current];
      setTimeline((prevT) =>
        prevT.some((s) => s.id === stage)
          ? prevT
          : [...prevT.slice(-5), { id: stage, label: stage, ts: Date.now() }]
      );
    }, 1200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.some((l) => l.online)]);

  // Sync counters + chart history from persisted backend metrics (survives tab close).
  useEffect(() => {
    const nextUsage = resolveUsageTotals({
      usageTotals,
      benchmark,
      metrics,
      storageKey: usageStorageKey,
    });
    setCounters((prev) => ({
      ...prev,
      tokens: nextUsage.tokens,
      cost: nextUsage.cost,
      latency: nextUsage.latency || prev.latency,
      requests: nextUsage.requests,
      activeAgents: nextUsage.activeAgents ?? prev.activeAgents ?? 0,
    }));
    if (usageStorageKey && (nextUsage.tokens > 0 || nextUsage.requests > 0)) {
      writeStoredUsage(usageStorageKey, nextUsage);
    }

    const nextHistory = metricsToHistory(metrics);
    if (nextHistory.length > 0) {
      setHistory(nextHistory);
    }

    if (metrics?.length > 0) {
      const totalTokens = metrics.reduce((sum, row) => sum + (row.tokens_used || 0), 0);
      const avgLat = Math.round(
        metrics.reduce((sum, row) => sum + (row.latency_ms || 0), 0) / metrics.length
      );
      setLog((prev) =>
        prev.some((entry) => entry.text.startsWith('Metrics'))
          ? prev
          : [
              ...prev,
              {
                id: `seed-${Date.now()}`,
                ts: Date.now(),
                level: 'info',
                text: `Metrics loaded — ${totalTokens.toLocaleString()} tokens, avg ${avgLat || '—'}ms latency`,
              },
            ]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usageTotals, benchmark, metrics, usageStorageKey]);

  // --- control actions for the command palette ---
  const createAgent = () => {
    const base = rosterRef.current || agents;
    const proto = AGENT_POOL[Object.keys(AGENT_POOL)[base.length % Object.keys(AGENT_POOL).length]];
    const name = `sub-${proto.label.toLowerCase().split(' ')[0]}-${base.length + 1}`;
    const entry = {
      name,
      label: proto.label,
      icon: agents[0]?.icon,
      color: proto.color,
      desc: proto.desc,
      model: proto.model,
      provider: 'groq',
      fallback: 'openrouter',
    };
    pushEvent(name, EVENT_KINDS[2]);
    setRoster((prev) => [...(prev || agents), entry]);
    return true;
  };

  const cloneAgent = (name) => {
    const base = rosterRef.current || agents;
    const src = base.find((a) => a.name === name);
    if (!src) return false;
    const cloneName = `${src.name}-c${++cloneCounter}`;
    const entry = { ...src, name: cloneName, label: `${src.label} Clone`, color: src.color };
    pushEvent(cloneName, EVENT_KINDS[0]);
    setRoster((prev) => [...(prev || agents), entry]);
    return true;
  };

  const pauseAgent = (name) => {
    setLive((prev) =>
      prev.map((l) =>
        l.name === name
          ? { ...l, online: false, liveliness: { ...l.liveliness, phase: 'resting' } }
          : l
      )
    );
    return true;
  };

  const resumeAgent = (name) => {
    setLive((prev) =>
      prev.map((l) =>
        l.name === name ? { ...l, online: true, liveliness: { ...l.liveliness, phase: 'idle' } } : l
      )
    );
    return true;
  };

  return {
    live,
    roster,
    events,
    pulses,
    timeline,
    history,
    counters,
    log,
    uptime,
    dismissEvent: (id) => setEvents((prev) => prev.filter((e) => e.id !== id)),
    actions: { createAgent, cloneAgent, pauseAgent, resumeAgent, clearLog: () => setLog([]) },
  };
}
