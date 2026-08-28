/**
 * Retrieve tasks relevant to a query — by keyword, priority, or upcoming deadline.
 */
const pool = require('../db');

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.query]
 * @param {number} [opts.limit=10]
 * @returns {Promise<Array>}
 */
async function retrieveTasks({ userId, query, limit = 10 }) {
  if (!userId) return [];
  const start = Date.now();

  try {
    let results = [];

    if (query) {
      const like = `%${query}%`;
      const res = await pool.query(
        `SELECT id, title, description, status, priority, due_at, ai_priority_score, quadrant
         FROM tasks
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND (title ILIKE $2 OR description ILIKE $2)
         ORDER BY priority DESC, due_at ASC NULLS LAST
         LIMIT $3`,
        [userId, like, limit]
      );
      results = res.rows;
    }

    // Supplement with high-priority active tasks
    if (results.length < limit) {
      const res = await pool.query(
        `SELECT id, title, description, status, priority, due_at, ai_priority_score, quadrant
         FROM tasks
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND status NOT IN ('done','cancelled','archived')
         ORDER BY priority DESC, due_at ASC NULLS LAST
         LIMIT $2`,
        [userId, limit - results.length]
      );
      const seen = new Set(results.map((r) => r.id));
      results = results.concat(res.rows.filter((r) => !seen.has(r.id)));
    }

    await pool
      .query(
        `INSERT INTO retrieval_logs (user_id, query, source, result_count, latency_ms, had_results)
       VALUES ($1,$2,'tasks',$3,$4,$5)`,
        [userId, query || '', results.length, Date.now() - start, results.length > 0]
      )
      .catch(() => {});

    return results;
  } catch (err) {
    console.error('[retrieveTasks] Error:', err.message);
    return [];
  }
}

module.exports = { retrieveTasks };
