/**
 * Evaluation API Routes
 * 
 * Exposes RAGAS-inspired quality metrics and per-request evaluation data.
 * All routes are protected by authMiddleware.
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getEvaluationSummary } = require('../agents/metricsLogger');

// GET /api/evaluation/summary
// Aggregated quality metrics for the authenticated user
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const summary = await getEvaluationSummary(req.user.id, hours);
    res.json({ success: true, data: summary, window_hours: hours });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/evaluation/recent
// Last N evaluated requests for the user
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const result = await pool.query(
      `SELECT id, query, retrieved_doc_count, groundedness_score,
              hallucination_risk, latency_ms, sources_used, agents_used, created_at
       FROM evaluation_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/evaluation/agents
// Per-agent quality breakdown
router.get('/agents', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const result = await pool.query(
      `SELECT
         UNNEST(agents_used) AS agent,
         COUNT(*)::int AS requests,
         ROUND(AVG(groundedness_score)::numeric, 3)::float AS avg_groundedness,
         COUNT(*) FILTER (WHERE hallucination_risk = TRUE)::int AS hallucinations,
         ROUND(AVG(latency_ms))::int AS avg_latency_ms
       FROM evaluation_logs
       WHERE user_id = $1
         AND created_at > NOW() - ($2 * INTERVAL '1 hour')
       GROUP BY agent
       ORDER BY requests DESC`,
      [req.user.id, hours]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/evaluation/retrieval
// Per-source retrieval hit rate analytics
router.get('/retrieval', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const result = await pool.query(
      `SELECT
         source,
         COUNT(*)::int AS queries,
         SUM(result_count)::int AS total_results,
         ROUND(AVG(result_count))::int AS avg_results,
         COUNT(*) FILTER (WHERE had_results = TRUE)::int AS queries_with_results,
         ROUND(AVG(latency_ms))::int AS avg_latency_ms
       FROM retrieval_logs
       WHERE user_id = $1
         AND created_at > NOW() - ($2 * INTERVAL '1 hour')
       GROUP BY source
       ORDER BY queries DESC`,
      [req.user.id, hours]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
