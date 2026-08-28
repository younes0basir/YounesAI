import {
  MessageSquare,
  Brain,
  Search,
  Database,
  Terminal,
  ShieldCheck,
  Send,
  Network,
  GitBranch,
  Activity,
  BarChart3,
  Plus,
  Wrench,
  HardDrive,
  Copy,
  Pause,
  Play,
  MemoryStick,
  ListOrdered,
  FileSearch,
} from 'lucide-react';

export const WORKSPACE_MODES = [
  { id: 'network', label: 'Network', icon: Network, hint: 'Living view of the whole crew' },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: GitBranch,
    hint: 'How a request flows through stages',
  },
  { id: 'timeline', label: 'Timeline', icon: Activity, hint: 'Step-by-step story of a run' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hint: 'Calls, latency, tokens & cost' },
  { id: 'debug', label: 'Debug', icon: Terminal, hint: 'Sandbox, raw logs & system news' },
];

export const TIMELINE_STEPS = [
  { id: 'request', label: 'User Request', short: 'Input', icon: MessageSquare, color: '#8b5cf6' },
  { id: 'planner', label: 'Planner', short: 'Route', icon: Brain, color: '#7c3aed' },
  { id: 'research', label: 'Research Agent', short: 'Research', icon: Search, color: '#06b6d4' },
  {
    id: 'knowledge',
    label: 'Knowledge Agent',
    short: 'Knowledge',
    icon: Database,
    color: '#f59e0b',
  },
  { id: 'coder', label: 'Coder Agent', short: 'Coder', icon: Terminal, color: '#10b981' },
  { id: 'reviewer', label: 'Reviewer', short: 'Review', icon: ShieldCheck, color: '#f43f5e' },
  { id: 'final', label: 'Final Response', short: 'Result', icon: Send, color: '#8b5cf6' },
];

export const PALETTE_COMMANDS = [
  {
    id: 'create-agent',
    label: 'Create Agent',
    hint: 'Spawn a new specialist into the crew',
    icon: Plus,
  },
  {
    id: 'create-subagent',
    label: 'Create Subagent',
    hint: 'Branch a focused worker from a node',
    icon: GitBranch,
  },
  {
    id: 'assign-task',
    label: 'Assign Task',
    hint: 'Give the selected agent a live objective',
    icon: ListOrdered,
  },
  { id: 'run-workflow', label: 'Run Workflow', hint: 'Fire a full pipeline run now', icon: Play },
  { id: 'pause-agent', label: 'Pause Agent', hint: 'Set the selected agent to rest', icon: Pause },
  {
    id: 'resume-agent',
    label: 'Resume Agent',
    hint: 'Wake the selected agent back up',
    icon: Play,
  },
  { id: 'clone-agent', label: 'Clone Agent', hint: 'Duplicate the selected node', icon: Copy },
  {
    id: 'inspect-memory',
    label: 'Inspect Memory',
    hint: 'Open memory & conversation inspector',
    icon: MemoryStick,
  },
  { id: 'open-logs', label: 'Open Logs', hint: 'Jump to the live engine log', icon: FileSearch },
];

export const EVENT_KINDS = [
  { kind: 'complete', icon: MessageSquare, label: 'Research completed', tone: 'emerald' },
  { kind: 'memory', icon: MemoryStick, label: 'Memory updated', tone: 'amber' },
  { kind: 'tool', icon: Wrench, label: 'Tool executed', tone: 'violet' },
  { kind: 'reason', icon: Brain, label: 'New reasoning step', tone: 'cyan' },
  { kind: 'file', icon: HardDrive, label: 'File indexed', tone: 'blue' },
];

export const AGENT_AURAS = {
  idle: { color: '#7e8aa8', hint: 'listening' },
  thinking: { color: '#8b5cf6', hint: 'reasoning' },
  working: { color: '#10b981', hint: 'processing' },
  resting: { color: '#a5b1c9', hint: 'resting' },
};

/* Palette command -> handler key so pages stay generic */
export const PALETTE_ACTIONS = {
  createAgent: 'create-agent',
  createSubagent: 'create-subagent',
  assignTask: 'assign-task',
  runWorkflow: 'run-workflow',
  pauseAgent: 'pause-agent',
  resumeAgent: 'resume-agent',
  cloneAgent: 'clone-agent',
  inspectMemory: 'inspect-memory',
  openLogs: 'open-logs',
};
