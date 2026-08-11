/**
 * Retrieve calendar events — upcoming by default, or filtered by keyword.
 */
const pool = require('../db');

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.query]
 * @param {number} [opts.limit=10]
 * @param {string} [opts.window='14 days']  — how far ahead to look
 * @returns {Promise<Array>}
 */
async function retrieveEvents({ userId, query, limit = 10, window = '14 days' }) {
  if (!userId) return [];
  const start = Date.now();

  try {
    let results = [];

    if (query) {
      const like = `%${query}%`;
      const res = await pool.query(
        `SELECT id, title, description, starts_at, ends_at, color, is_all_day
         FROM calendar_events
         WHERE user_id = $1 AND (title ILIKE $2 OR description ILIKE $2)
         ORDER BY starts_at ASC
         LIMIT $3`,
        [userId, like, limit]
      );
      results = res.rows;
    }

    if (results.length < limit) {
      const res = await pool.query(
        `SELECT id, title, description, starts_at, ends_at, color, is_all_day
         FROM calendar_events
         WHERE user_id = $1
           AND starts_at >= NOW()
           AND starts_at <= NOW() + ($2)::interval
         ORDER BY starts_at ASC
         LIMIT $3`,
        [userId, window, limit - results.length]
      );
      const seen = new Set(results.map(r => r.id));
      results = results.concat(res.rows.filter(r => !seen.has(r.id)));
    }

    await pool.query(
      `INSERT INTO retrieval_logs (user_id, query, source, result_count, latency_ms, had_results)
       VALUES ($1,$2,'events',$3,$4,$5)`,
      [userId, query || '', results.length, Date.now() - start, results.length > 0]
    ).catch(() => {});

    return results;
  } catch (err) {
    console.error('[retrieveEvents] Error:', err.message);
    return [];
  }
}

module.exports = { retrieveEvents };
