/**
 * Retrieve recent and relevant conversations for context grounding.
 */
const pool = require('../db');

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.query]
 * @param {number} [opts.limit=5]
 * @returns {Promise<Array>}
 */
async function retrieveConversations({ userId, query, limit = 5 }) {
  if (!userId) return [];
  const start = Date.now();

  try {
    let results = [];

    if (query) {
      const like = `%${query}%`;
      const res = await pool.query(
        `SELECT id, role, content, intent, created_at
         FROM conversations
         WHERE user_id = $1 AND (content ILIKE $2 OR intent ILIKE $2)
         ORDER BY created_at DESC
         LIMIT $3`,
        [userId, like, limit]
      );
      results = res.rows;
    }

    // Always fill with recent if not enough results
    if (results.length < limit) {
      const res = await pool.query(
        `SELECT id, role, content, intent, created_at
         FROM conversations
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit - results.length]
      );
      // Merge deduplicating by id
      const seen = new Set(results.map(r => r.id));
      results = results.concat(res.rows.filter(r => !seen.has(r.id)));
    }

    await pool.query(
      `INSERT INTO retrieval_logs (user_id, query, source, result_count, latency_ms, had_results)
       VALUES ($1,$2,'conversations',$3,$4,$5)`,
      [userId, query || '', results.length, Date.now() - start, results.length > 0]
    ).catch(() => {});

    return results;
  } catch (err) {
    console.error('[retrieveConversations] Error:', err.message);
    return [];
  }
}

module.exports = { retrieveConversations };
