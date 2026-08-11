const pool = require('../db');

async function searchPlaces(context, query) {
  const like = `%${query || ''}%`;
  const result = await pool.query(
    `SELECT id, name, address, category, latitude, longitude, is_visited
     FROM places
     WHERE user_id = $1 AND (name ILIKE $2 OR address ILIKE $2 OR category ILIKE $2)
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 20`,
    [context.userId, like]
  );
  return { success: true, places: result.rows };
}

module.exports = searchPlaces;
