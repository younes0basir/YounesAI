const RECENT_MS = 5 * 60 * 1000;

export function buildIntelStats({ benchmark = [], summary = [], metrics = [], agentsLive = 0 }) {
  const recentAgents = new Set(
    metrics
      .filter((row) => Date.now() - new Date(row.created_at).getTime() <= RECENT_MS)
      .map((row) => row.agent_name)
      .filter(Boolean)
  );

  const rows = benchmark.length > 0 ? benchmark : summary.length > 0 ? summary : null;

  if (rows) {
    const tokens = rows.reduce((sum, row) => sum + (row.total_tokens || 0), 0);
    const requests = rows.reduce((sum, row) => sum + (row.total_calls || 0), 0);
    const cost =
      benchmark.length > 0
        ? benchmark.reduce((sum, row) => sum + (row.estimated_cost_usd || 0), 0)
        : tokens * 0.0000002;
    const latency = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + (row.avg_latency_ms || 0), 0) / rows.length)
      : 0;
    const usedAgents = new Set(
      rows.filter((row) => row.total_calls > 0).map((row) => row.agent_name)
    ).size;

    return {
      tokens,
      cost,
      requests,
      latency,
      activeAgents: recentAgents.size || usedAgents,
      agentsOnline: agentsLive,
    };
  }

  if (metrics.length > 0) {
    const tokens = metrics.reduce((sum, row) => sum + (row.tokens_used || 0), 0);
    const latency = Math.round(
      metrics.reduce((sum, row) => sum + (row.latency_ms || 0), 0) / metrics.length
    );
    const usedAgents = new Set(metrics.map((row) => row.agent_name).filter(Boolean)).size;

    return {
      tokens,
      cost: tokens * 0.0000002,
      requests: metrics.length,
      latency,
      activeAgents: recentAgents.size || usedAgents,
      agentsOnline: agentsLive,
    };
  }

  return {
    tokens: 0,
    cost: 0,
    requests: 0,
    latency: 0,
    activeAgents: 0,
    agentsOnline: agentsLive,
  };
}

export function formatTokenCount(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function formatCost(value) {
  return `$${(Number(value) || 0).toFixed(4)}`;
}

export function formatLatency(value) {
  return `${Math.round(Number(value) || 0)}ms`;
}
