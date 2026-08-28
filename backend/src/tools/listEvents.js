const pool = require('../db');

async function listEvents(context, filters = {}) {
  const where = ['user_id = $1'];
  const params = [context.userId];
  let idx = 2;

  if (filters.past) {
    where.push(`starts_at < NOW()`);
  } else {
    where.push(`starts_at >= NOW()`);
  }

  if (filters.color) {
    where.push(`color = $${idx++}`);
    params.push(filters.color);
  }

  const result = await pool.query(
    `SELECT id, title, description, starts_at, ends_at, is_all_day, color, location_text, created_at
     FROM calendar_events
     WHERE ${where.join(' AND ')}
     ORDER BY starts_at ASC
     LIMIT 20`,
    params
  );
  return { success: true, events: result.rows };
}

module.exports = listEvents;
