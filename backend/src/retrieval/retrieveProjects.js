/**
 * Retrieve projects and their membership/metadata for context grounding.
 */
const pool = require('../db');

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.query]
 * @param {number} [opts.limit=5]
 * @returns {Promise<Array>}
 */
async function retrieveProjects({ userId, query, limit = 5 }) {
  if (!userId) return [];
  const start = Date.now();

  try {
    let results = [];

    if (query) {
      const like = `%${query}%`;
      const res = await pool.query(
        `SELECT p.id, p.name, p.description, p.created_at,
                COUNT(DISTINCT pm.user_id)::int AS member_count,
                COUNT(DISTINCT t.id)::int AS task_count
         FROM projects p
         LEFT JOIN project_memberships pm ON pm.project_id = p.id
         LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
         WHERE p.owner_id = $1 AND (p.name ILIKE $2 OR p.description ILIKE $2)
         GROUP BY p.id
         ORDER BY p.created_at DESC
         LIMIT $3`,
        [userId, like, limit]
      );
      results = res.rows;
    }

    if (results.length < limit) {
      const res = await pool.query(
        `SELECT p.id, p.name, p.description, p.created_at,
                COUNT(DISTINCT pm.user_id)::int AS member_count,
                COUNT(DISTINCT t.id)::int AS task_count
         FROM projects p
         LEFT JOIN project_memberships pm ON pm.project_id = p.id
         LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
         WHERE p.owner_id = $1
         GROUP BY p.id
         ORDER BY p.created_at DESC
         LIMIT $2`,
        [userId, limit - results.length]
      );
      const seen = new Set(results.map(r => r.id));
      results = results.concat(res.rows.filter(r => !seen.has(r.id)));
    }

    await pool.query(
      `INSERT INTO retrieval_logs (user_id, query, source, result_count, latency_ms, had_results)
       VALUES ($1,$2,'projects',$3,$4,$5)`,
      [userId, query || '', results.length, Date.now() - start, results.length > 0]
    ).catch(() => {});

    return results;
  } catch (err) {
    console.error('[retrieveProjects] Error:', err.message);
    return [];
  }
}

module.exports = { retrieveProjects };
