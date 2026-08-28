/**
 * Monitoring Dashboard API
 *
 * Exposes system health, knowledge graph stats, document index status,
 * and retrieval performance. Public monitoring endpoints.
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getAgentSummary } = require('../agents/metricsLogger');
const { buildUserGraph } = require('../knowledge/graphQueries');

// GET /api/monitoring/agent-health
// Per-agent success rate, avg tokens, error count
router.get('/agent-health', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const summary = await getAgentSummary(hours);
    res.json({ success: true, data: summary, window_hours: hours });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/monitoring/knowledge-graph
// Entity counts, relationship types, top connected entities for the user
router.get('/knowledge-graph', authMiddleware, async (req, res) => {
  try {
    const graph = await buildUserGraph(req.user.id);

    // Total edge count
    const edgeCount = await pool
      .query(`SELECT COUNT(*)::int AS count FROM entity_relationships WHERE user_id = $1`, [
        req.user.id,
      ])
      .then((r) => r.rows[0]?.count || 0)
      .catch(() => 0);

    res.json({
      success: true,
      data: {
        ...graph,
        totalEdges: edgeCount,
        totalEntityTypes: graph.entityCounts?.length || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/monitoring/document-index
// Indexed file count, coverage by type, last indexed dates
router.get('/document-index', authMiddleware, async (req, res) => {
  try {
    const [stats, byType, folders] = await Promise.all([
      pool
        .query(
          `SELECT
           COUNT(DISTINCT file_path)::int AS unique_files,
           COUNT(*)::int AS total_chunks,
           ROUND(AVG(word_count))::int AS avg_word_count,
           MAX(created_at) AS last_indexed
         FROM document_embeddings
         WHERE user_id = $1`,
          [req.user.id]
        )
        .then((r) => r.rows[0])
        .catch(() => ({})),

      pool
        .query(
          `SELECT file_type, COUNT(DISTINCT file_path)::int AS file_count
         FROM document_embeddings
         WHERE user_id = $1 AND file_type IS NOT NULL
         GROUP BY file_type ORDER BY file_count DESC`,
          [req.user.id]
        )
        .then((r) => r.rows)
        .catch(() => []),

      pool
        .query(
          `SELECT folder_path, is_active, last_scan, created_at
         FROM indexed_folders
         WHERE user_id = $1
         ORDER BY last_scan DESC NULLS LAST`,
          [req.user.id]
        )
        .then((r) => r.rows)
        .catch(() => []),
    ]);

    res.json({ success: true, data: { stats, byType, watchedFolders: folders } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/monitoring/retrieval-stats
// Query counts, avg latency, hit rates per source
router.get('/retrieval-stats', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const result = await pool.query(
      `SELECT
         source,
         COUNT(*)::int AS total_queries,
         COUNT(*) FILTER (WHERE had_results = TRUE)::int AS queries_with_hits,
         ROUND(100.0 * COUNT(*) FILTER (WHERE had_results = TRUE) / NULLIF(COUNT(*), 0))::int AS hit_rate_pct,
         ROUND(AVG(result_count))::int AS avg_results,
         ROUND(AVG(latency_ms))::int AS avg_latency_ms,
         MAX(created_at) AS last_queried
       FROM retrieval_logs
       WHERE user_id = $1
         AND created_at > NOW() - ($2 * INTERVAL '1 hour')
       GROUP BY source
       ORDER BY total_queries DESC`,
      [req.user.id, hours]
    );

    // Overall totals
    const totals = await pool
      .query(
        `SELECT COUNT(*)::int AS total, ROUND(AVG(latency_ms))::int AS avg_ms
       FROM retrieval_logs
       WHERE user_id = $1 AND created_at > NOW() - ($2 * INTERVAL '1 hour')`,
        [req.user.id, hours]
      )
      .then((r) => r.rows[0])
      .catch(() => ({}));

    res.json({
      success: true,
      data: result.rows,
      totals,
      window_hours: hours,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/monitoring/system-health — lightweight health check
router.get('/system-health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'disconnected', error: err.message });
  }
});

module.exports = router;
