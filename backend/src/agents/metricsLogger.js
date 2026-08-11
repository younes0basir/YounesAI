const pool = require('../db');

/**
 * Log a single agent call to the agent_metrics table.
 * Never throws — metrics must not crash the main request flow.
 */
async function logAgentCall({ agentName, provider, model, latency, success, error, tokensUsed, context }) {
  try {
    await pool.query(
      `INSERT INTO agent_metrics
         (agent_name, provider, model, latency_ms, success, error_message,
          tokens_used, user_id, conversation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        agentName,
        provider           || 'unknown',
        model              || null,
        Math.round(latency || 0),
        success            ?? true,
        error              ? String(error).substring(0, 500) : null,
        tokensUsed         || 0,
        context?.userId    || null,
        context?.conversationId || null,
      ]
    );
  } catch (err) {
    // Silently swallow — metrics must never crash the main flow
    console.error('[Metrics] Failed to log agent call:', err.message);
  }
}

/**
 * Fetch recent agent metric rows with optional filters.
 */
async function getAgentMetrics(limit = 50, filters = {}) {
  const whereClauses = [];
  const params = [];

  if (filters.userId) {
    whereClauses.push(`user_id = $${params.length + 1}`);
    params.push(filters.userId);
  }
  if (filters.agentName) {
    whereClauses.push(`agent_name = $${params.length + 1}`);
    params.push(filters.agentName);
  }
  if (filters.hours) {
    whereClauses.push(`created_at > NOW() - ($${params.length + 1} * INTERVAL '1 hour')`);
    params.push(filters.hours);
  }
  if (filters.onlyFailures) {
    whereClauses.push('success = FALSE');
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  params.push(Math.min(limit, 500));

  const result = await pool.query(
    `SELECT * FROM agent_metrics ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return result.rows;
}

/**
 * Aggregate metrics summary by agent + provider over a rolling window.
 */
async function getAgentSummary(hours = 24) {
  const safeHours = Math.min(Math.max(parseInt(hours, 10) || 24, 1), 168); // 1h – 7 days
  const result = await pool.query(
    `SELECT
       agent_name,
       provider,
       COUNT(*)::int                                                  AS total_calls,
       COUNT(*) FILTER (WHERE success = TRUE)::int                    AS success_count,
       COUNT(*) FILTER (WHERE success = FALSE)::int                   AS failure_count,
       ROUND(AVG(latency_ms))::int                                    AS avg_latency_ms,
       ROUND(AVG(latency_ms) FILTER (WHERE success = TRUE))::int      AS avg_success_latency_ms,
       SUM(tokens_used)::int                                          AS total_tokens,
       MAX(created_at)                                                AS last_call
     FROM agent_metrics
     WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
     GROUP BY agent_name, provider
     ORDER BY total_calls DESC`,
    [safeHours]
  );
  return result.rows;
}

/**
 * Log retrieval quality metrics for a single agent request.
 * Implements RAGAS-inspired evaluation: groundedness, precision, hallucination risk.
 * Never throws — evaluation must not crash the main flow.
 *
 * @param {object} opts
 * @param {string}   opts.userId
 * @param {string}   opts.query
 * @param {Array}    opts.evidence         — retrieved docs/items used
 * @param {string}   opts.agentResponse    — the final agent response text
 * @param {string[]} opts.sourcesUsed      — retrieval source names
 * @param {string[]} opts.agentsUsed
 * @param {number}   opts.latencyMs
 * @param {string}   [opts.agentMetricId]
 */
async function logRetrievalQuality({
  userId, query, evidence, agentResponse, sourcesUsed, agentsUsed, latencyMs, agentMetricId
}) {
  try {
    const retrieved = evidence?.length || 0;

    // Groundedness: check how much of the response can be traced to evidence
    let groundednessScore = 0;
    let hallucinationRisk = false;

    if (retrieved > 0 && agentResponse) {
      const evidenceTexts = evidence.map(e => (e.text || e.content || '').toLowerCase());
      const responseLower = agentResponse.toLowerCase();
      const words = responseLower.split(/\s+/).filter(w => w.length > 4);
      const wordsInEvidence = words.filter(w =>
        evidenceTexts.some(et => et.includes(w))
      );
      groundednessScore = words.length > 0 ? wordsInEvidence.length / words.length : 0;
      hallucinationRisk = groundednessScore < 0.15 && retrieved > 0;
    } else if (retrieved === 0) {
      // No evidence retrieved but agent still responded — potential hallucination
      hallucinationRisk = Boolean(agentResponse && agentResponse.length > 50);
    }

    await pool.query(
      `INSERT INTO evaluation_logs
         (user_id, agent_metric_id, query, retrieved_doc_count,
          groundedness_score, hallucination_risk, latency_ms,
          sources_used, agents_used, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [
        userId || null,
        agentMetricId || null,
        query || '',
        retrieved,
        Math.round(groundednessScore * 100) / 100,
        hallucinationRisk,
        Math.round(latencyMs || 0),
        sourcesUsed || [],
        agentsUsed || [],
      ]
    );
  } catch (err) {
    console.error('[Metrics] logRetrievalQuality failed:', err.message);
  }
}

/**
 * Get aggregated evaluation summary.
 */
async function getEvaluationSummary(userId, hours = 24) {
  const safeHours = Math.min(Math.max(parseInt(hours, 10) || 24, 1), 168);
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int                                                        AS total_requests,
         ROUND(AVG(groundedness_score)::numeric, 3)::float                   AS avg_groundedness,
         COUNT(*) FILTER (WHERE hallucination_risk = TRUE)::int              AS hallucination_count,
         ROUND(AVG(retrieved_doc_count))::int                                AS avg_docs_retrieved,
         ROUND(AVG(latency_ms))::int                                         AS avg_latency_ms,
         MAX(created_at)                                                     AS last_evaluated
       FROM evaluation_logs
       WHERE ($1::uuid IS NULL OR user_id = $1)
         AND created_at > NOW() - ($2 * INTERVAL '1 hour')`,
      [userId || null, safeHours]
    );
    return result.rows[0] || {};
  } catch (err) {
    console.error('[Metrics] getEvaluationSummary failed:', err.message);
    return {};
  }
}

/**
 * Get detailed benchmarking metrics per agent including hallucination rates, costs, error types.
 */
async function getAgentBenchmarkMetrics(hours = 24) {
  const safeHours = Math.min(Math.max(parseInt(hours, 10) || 24, 1), 168);
  try {
    // Provider pricing (per 1K tokens) - approximate
    const pricing = {
      'Groq': { input: 0.0001, output: 0.0001 },
      'NVIDIA': { input: 0.0001, output: 0.0001 },
      'OpenRouter': { input: 0.0001, output: 0.0001 },
    };

    const result = await pool.query(
      `SELECT
         am.agent_name,
         am.provider,
         am.model,
         COUNT(*)::int                                                  AS total_calls,
         COUNT(*) FILTER (WHERE am.success = TRUE)::int                AS success_count,
         COUNT(*) FILTER (WHERE am.success = FALSE)::int               AS failure_count,
         ROUND(AVG(am.latency_ms))::int                               AS avg_latency_ms,
         ROUND(AVG(am.latency_ms) FILTER (WHERE am.success = TRUE))::int AS avg_success_latency_ms,
         SUM(am.tokens_used)::int                                      AS total_tokens,
         COUNT(DISTINCT am.user_id)::int                               AS unique_users,
         MAX(am.created_at)                                            AS last_call,
         -- Evaluation metrics
         COALESCE(el.total_evals, 0)::int                              AS total_evals,
         COALESCE(el.hallucination_count, 0)::int                      AS hallucination_count,
         COALESCE(ROUND(el.avg_groundedness::numeric, 3), 0)::float    AS avg_groundedness,
         COALESCE(ROUND(el.avg_retrieved_docs::numeric, 1), 0)::float  AS avg_retrieved_docs,
         -- Error breakdown
         COUNT(*) FILTER (WHERE am.error_message IS NOT NULL)::int      AS error_count,
         STRING_AGG(DISTINCT LEFT(am.error_message, 50), ', ') FILTER (WHERE am.error_message IS NOT NULL) AS error_types
       FROM agent_metrics am
       LEFT JOIN (
         SELECT
           agent_metric_id,
           COUNT(*)::int AS total_evals,
           COUNT(*) FILTER (WHERE hallucination_risk = TRUE)::int AS hallucination_count,
           AVG(groundedness_score) AS avg_groundedness,
           AVG(retrieved_doc_count) AS avg_retrieved_docs
         FROM evaluation_logs
         WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
         GROUP BY agent_metric_id
       ) el ON am.id = el.agent_metric_id
       WHERE am.created_at > NOW() - ($1 * INTERVAL '1 hour')
       GROUP BY am.agent_name, am.provider, am.model, el.total_evals, el.hallucination_count, el.avg_groundedness, el.avg_retrieved_docs
       ORDER BY total_calls DESC`,
      [safeHours]
    );

    // Calculate costs and derived metrics
    const metrics = result.rows.map(row => {
      const providerPricing = pricing[row.provider] || { input: 0.0001, output: 0.0001 };
      const estimatedCost = (row.total_tokens / 1000) * (providerPricing.input + providerPricing.output);
      const successRate = row.total_calls > 0 ? (row.success_count / row.total_calls) * 100 : 0;
      const hallucinationRate = row.total_evals > 0 ? (row.hallucination_count / row.total_evals) * 100 : 0;
      const errorRate = row.total_calls > 0 ? (row.error_count / row.total_calls) * 100 : 0;

      return {
        ...row,
        success_rate: Math.round(successRate * 10) / 10,
        hallucination_rate: Math.round(hallucinationRate * 10) / 10,
        error_rate: Math.round(errorRate * 10) / 10,
        estimated_cost_usd: Math.round(estimatedCost * 1000) / 1000,
        cost_per_call: row.total_calls > 0 ? Math.round((estimatedCost / row.total_calls) * 10000) / 10000 : 0,
      };
    });

    return metrics;
  } catch (err) {
    console.error('[Metrics] getAgentBenchmarkMetrics failed:', err.message);
    return [];
  }
}

/**
 * Get performance trends over time for each agent.
 */
async function getAgentPerformanceTrends(hours = 168) {
  const safeHours = Math.min(Math.max(parseInt(hours, 10) || 168, 1), 720); // 1h - 30 days
  try {
    const result = await pool.query(
      `SELECT
         agent_name,
         DATE_TRUNC('hour', created_at) AS hour,
         COUNT(*)::int AS calls,
         COUNT(*) FILTER (WHERE success = TRUE)::int AS successes,
         ROUND(AVG(latency_ms))::int AS avg_latency,
         SUM(tokens_used)::int AS total_tokens
       FROM agent_metrics
       WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
       GROUP BY agent_name, DATE_TRUNC('hour', created_at)
       ORDER BY agent_name, hour DESC
       LIMIT 500`,
      [safeHours]
    );
    return result.rows;
  } catch (err) {
    console.error('[Metrics] getAgentPerformanceTrends failed:', err.message);
    return [];
  }
}

module.exports = { logAgentCall, getAgentMetrics, getAgentSummary, logRetrievalQuality, getEvaluationSummary, getAgentBenchmarkMetrics, getAgentPerformanceTrends };
